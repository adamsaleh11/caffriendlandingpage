import { NextResponse } from 'next/server';
import { getSession, clearSession, sameOrigin } from '@/lib/session';
import { backend, BackendError } from '@/lib/backend';
import { projectSuggestion, projectConnection, projectCall, projectRank, projectProfile, projectProfileDetail, type AppConnection } from '@/lib/app-projection';

/**
 * The consumer Caffriend surface (Home, Connections, Calls, Leaderboard, Profile).
 *
 * Every call below is the same endpoint, payload and response handling the native
 * app uses — the screens differ only in presentation. It reuses the CRM's sealed
 * session, because `/user/login` issues the one token both surfaces carry.
 */
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {status, headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});

const failure = (error: unknown) => {
  const status = error instanceof BackendError ? error.status : 503;
  return {status, body:{error:
    status === 403 ? 'You no longer have access here.' :
    status === 404 ? 'This is unavailable.' :
    'This could not be loaded right now.'}};
};

const unwrap = (body: unknown): unknown => {
  const value = body as {data?: unknown};
  return value && typeof value === 'object' && value !== null && 'data' in value ? value.data : body;
};
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value as Record<string, unknown>[] : [];

/** Fetches public profiles a few at a time; a row whose profile fails keeps its base fields. */
async function withProfiles(rows: AppConnection[], token: string): Promise<AppConnection[]> {
  const limit = 6;
  const out = [...rows];
  for (let start = 0; start < out.length; start += limit) {
    const slice = out.slice(start, start + limit);
    const details = await Promise.all(slice.map(row =>
      backend(`/user/profile/${encodeURIComponent(row.userId)}`, {token})
        .then(projectProfileDetail)
        .catch(() => null)));
    details.forEach((detail, index) => { if (detail) Object.assign(slice[index], detail); });
  }
  return out;
}

export async function GET(request: Request, {params}:{params:Promise<{segments:string[]}>}) {
  const session = await getSession();
  if (!session) return json({error:'Sign in required'}, 401);
  const me = session.user.id;
  const segments = (await params).segments;
  const path = segments.join('/');
  const search = new URL(request.url).searchParams;
  try {
    if (path === 'me') return json(projectProfile(unwrap(await backend('/user/my-profile', {token:session.token}))));

    // `/match/matches` returns buckets, exactly as the native Connections screen reads them.
    if (path === 'connections') {
      const body = unwrap(await backend('/match/matches', {token:session.token})) as Record<string, unknown>;
      const rows: AppConnection[] = [];
      const seen = new Set<string>();
      for (const bucket of ['all', 'pending', 'new', 'newUser']) {
        for (const row of list(body?.[bucket])) {
          const projected = projectConnection(row, bucket, me);
          if (projected && !seen.has(projected.userId)) { seen.add(projected.userId); rows.push(projected); }
        }
      }
      // `/match/matches` carries only a name and an image, so each person's public
      // profile is fetched to fill in job title, industry and the rest. One slow or
      // missing profile must not lose the whole list, so failures degrade per row.
      return json(await withProfiles(rows, session.token));
    }

    if (path === 'calls') {
      const type = Number(search.get('type') ?? '1');
      if (!Number.isInteger(type)) return json({error:'Not found'}, 404);
      const rows = list(unwrap(await backend(`/calendar/accepted-events/${type}`, {token:session.token})));
      return json(rows.map(row => projectCall(row, me)));
    }

    if (path === 'leaderboard') {
      const limit = Math.min(Math.max(Number(search.get('limit') ?? '10'), 1), 100);
      const offset = Math.max(Number(search.get('offset') ?? '0'), 0);
      const body = unwrap(await backend(`/leaderboard?limit=${limit}&offset=${offset}`, {token:session.token})) as Record<string, unknown>;
      return json({
        items: list(body?.users).map(projectRank),
        currentPage: typeof body?.currentPage === 'number' ? body.currentPage : null,
        totalPages: typeof body?.totalPages === 'number' ? body.totalPages : null,
        totalCount: typeof body?.totalCount === 'number' ? body.totalCount : null,
        hasNextPage: body?.hasNextPage === true,
      });
    }
    return json({error:'Not found'}, 404);
  } catch (error) {
    const {status, body} = failure(error);
    if (status === 401) await clearSession();
    return json(body, status);
  }
}

export async function POST(request: Request, {params}:{params:Promise<{segments:string[]}>}) {
  if (!sameOrigin(request)) return json({error:'Request not allowed'}, 403);
  const session = await getSession();
  if (!session) return json({error:'Sign in required'}, 401);
  const me = session.user.id;
  const segments = (await params).segments;
  const path = segments.join('/');
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    // Same payload shape as useUserListQuery, including its page-based pagination.
    if (path === 'suggestions') {
      const page = Math.max(Number(body.page ?? 1), 1);
      const limit = Math.min(Math.max(Number(body.limit ?? 20), 1), 100);
      const payload: Record<string, unknown> = {page, limit, blocked: false};
      if (typeof body.role === 'string' && body.role) payload.role = body.role;
      const result = unwrap(await backend('/match/suggestions', {token:session.token, method:'POST', body:payload})) as Record<string, unknown>;
      const source = Array.isArray(result) ? result : list(result?.data);
      return json({
        items: source.map(projectSuggestion).filter(row => row.userId && row.userId !== me),
        page: typeof result?.page === 'number' ? result.page : page,
        totalPages: typeof result?.totalPages === 'number' ? result.totalPages : null,
      });
    }

    /**
     * The accept action. This is `createMatch` — the same call the native swipe-right
     * performs — not `approve-match`, which reviews an existing request instead.
     * The decider is always the signed-in person; the client cannot name someone else.
     */
    if (path === 'create-match') {
      if (typeof body.targetId !== 'string' || !body.targetId) return json({error:'Choose a person first.'}, 400);
      const result = unwrap(await backend<Record<string, unknown>>('/match/create-match',
        {token:session.token, method:'POST', body:{deciderId: me, targetId: body.targetId}})) as Record<string, unknown>;
      // The native path treats a 400-shaped body as a failure even inside a 200.
      if (Number(result?.status) === 400) return json({error: typeof result.message === 'string' ? result.message : 'That did not go through.'}, 400);
      return json({isMatched: result?.isMatched === true});
    }
    return json({error:'Not found'}, 404);
  } catch (error) {
    const {status, body: problem} = failure(error);
    if (status === 401) await clearSession();
    return json(problem, status);
  }
}
