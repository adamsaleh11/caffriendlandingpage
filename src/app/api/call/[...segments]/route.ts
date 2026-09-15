import { NextResponse } from 'next/server';
import { getSession, clearSession, sameOrigin } from '@/lib/session';
import { backend, BackendError } from '@/lib/backend';
import { projectCallState, projectMyCall, projectParticipant } from '@/lib/call';

/**
 * The video-call collaboration surface.
 *
 * The browser never holds the backend origin or the session token for these reads,
 * for the same reason the rest of the app does not: the origin and the sealed session
 * stay server-side. The `/calls` websocket is the one exception, and it takes its
 * token from `/api/session/token` rather than from here.
 */
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {status, headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});

const failure = (error: unknown) => {
  const status = error instanceof BackendError ? error.status : 503;
  return {status, body:{error:
    status === 403 ? 'You are not in this call.' :
    status === 404 ? 'This call is unavailable.' :
    'This call could not be loaded right now.'}};
};

const unwrap = (body: unknown): unknown => {
  const value = body as {data?: unknown};
  return value && typeof value === 'object' && value !== null && 'data' in value ? value.data : body;
};

const callSession = (request: Request) => {
  const value = request.headers.get('x-caffriend-call-session');
  return value && /^[A-Za-z0-9_-]{20,200}$/.test(value) ? value : null;
};

const authFor = async (request: Request) => {
  const session = await getSession();
  const token = callSession(request);
  return session
    ? {session, backendHeaders: {} as Record<string, string>, realtime:{token:session.token, callSessionToken:null as string | null}}
    : token
      ? {session:null, backendHeaders:{'x-caffriend-call-session':token}, realtime:{token:null as string | null, callSessionToken:token}}
      : null;
};

export async function GET(request: Request, {params}:{params:Promise<{segments:string[]}>}) {
  const segments = (await params).segments;
  // Resolution is public; guests prove access on the subsequent invitation-token join.
  if (segments.length === 2 && segments[1] === 'resolve' && /^[0-9a-f-]{36}$/i.test(segments[0])) {
    try {
      const session = await getSession();
      return json(await backend(`/group-calls/${encodeURIComponent(segments[0])}/resolve`, {
        token:session?.token,
        headers:{'x-caffriend-platform':'desktop'},
      }));
    } catch (error) {
      const {status, body} = failure(error);
      return json(body, status);
    }
  }
  const auth = await authFor(request);
  if (!auth) return json({error:'Sign in required'}, 401);
  try {
    /**
     * Every call the caller was in. Declared before the `:id` routes for the same reason
     * the backend does: otherwise "mine" is read as a call id.
     */
    if (segments.length === 1 && segments[0] === 'mine') {
      if (!auth.session) return json({error:'Sign in required'}, 401);
      const rows = unwrap(await backend('/group-calls/mine',
        {token:auth.session.token, headers:{'x-caffriend-platform':'desktop'}}));
      return json(Array.isArray(rows) ? (rows as Record<string, unknown>[]).map(projectMyCall) : []);
    }
    /**
     * What the browser needs to open the live-updates socket: the backend origin and a
     * token for the handshake. A websocket handshake cannot be proxied the way the REST
     * reads are, so this is the one place the origin and token reach page script — and
     * they are read from server-side env here rather than shipped in a public build var.
     */
    if (segments.length === 1 && segments[0] === 'realtime') {
      const origin = process.env.CAFFRIEND_API_ORIGIN;
      if (!origin) return json({origin:null, token:null});
      return json({origin, ...auth.realtime});
    }
    if (segments.length === 2 && segments[1] === 'call-state') {
      const id = encodeURIComponent(segments[0]);
      return json(projectCallState(unwrap(await backend(`/group-calls/${id}/call-state`,
        {token:auth.session?.token, headers:auth.backendHeaders}))));
    }
    return json({error:'Not found'}, 404);
  } catch (error) {
    const {status, body} = failure(error);
    if (status === 401 && auth.session) await clearSession();
    return json(body, status);
  }
}

/**
 * Mutations are relayed by shape rather than enumerated one by one: each is the same
 * authenticated POST to the matching `/group-calls` route. The path is rebuilt from
 * validated segments instead of being passed through, so a caller cannot steer the
 * request at another backend resource.
 */
const mutations: RegExp[] = [
  /^[0-9a-f-]{36}\/waiting-room\/[a-z0-9-]+\/(?:admit|decline)$/i,
  /^[0-9a-f-]{36}\/participants\/[a-z0-9-]+\/(?:state|remove)$/i,
  /^[0-9a-f-]{36}\/call-controls$/i,
  /^[0-9a-f-]{36}\/join$/i,
  /^[0-9a-f-]{36}\/(?:heartbeat|leave)$/i,
  /^[0-9a-f-]{36}\/call-chat\/messages$/i,
  /^[0-9a-f-]{36}\/(?:notes|action-items|agenda-blocks)$/i,
  /^[0-9a-f-]{36}\/action-items\/[a-z0-9-]+$/i,
];

export async function POST(request: Request, {params}:{params:Promise<{segments:string[]}>}) {
  if (!sameOrigin(request)) return json({error:'Request not allowed'}, 403);
  const auth = await authFor(request);
  const segments = (await params).segments;
  const path = segments.join('/');
  // `claim-guest` is the one POST here that names no call: it is about a person, not a
  // room, so it is allowed through the by-shape guard rather than matched by it.
  const claiming = path === 'claim-guest';
  if (!claiming && !mutations.some(pattern => pattern.test(path))) return json({error:'Not found'}, 404);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  /**
   * Handing this device's guest past to the account that just signed up. It swaps the
   * guest id for the real user id, so the calls attended as a guest become theirs and
   * every held connection intent becomes a match. Idempotent, and a no-op with no past.
   */
  if (segments.length === 1 && segments[0] === 'claim-guest') {
    if (!auth?.session) return json({error:'Sign in required'}, 401);
    const installId = body.anonymousInstallId;
    if (typeof installId !== 'string' || !/^[A-Za-z0-9_-]{8,200}$/.test(installId))
      return json({error:'Request not allowed'}, 400);
    try {
      return json(await backend('/group-calls/claim-guest', {token:auth.session.token, method:'POST',
        body:{anonymousInstallId:installId}, headers:{'x-caffriend-platform':'desktop'}}));
    } catch (error) {
      const {status, body: problem} = failure(error);
      return json(problem, status);
    }
  }
  const isJoin = segments.length === 2 && segments[1] === 'join';
  if (!auth && !isJoin) return json({error:'Sign in required'}, 401);
  if (!auth && (typeof body.invitationToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.invitationToken)))
    return json({error:'Sign in required'}, 401);
  try {
    const relayed = await backend(`/group-calls/${segments.map(encodeURIComponent).join('/')}`,
      {token:auth?.session?.token, method:'POST', body,
        headers:{'x-caffriend-platform':'desktop', ...(auth?.backendHeaders ?? {})}});
    const value = unwrap(relayed) as Record<string, unknown>;
    // A participant route answers with the changed row; the room routes answer with the room.
    return json(value && 'waitingStatus' in value ? projectParticipant(value) : value);
  } catch (error) {
    const {status, body: problem} = failure(error);
    if (status === 401 && auth?.session) await clearSession();
    return json(problem, status);
  }
}
