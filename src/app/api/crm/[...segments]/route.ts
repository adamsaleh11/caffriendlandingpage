import { NextResponse } from 'next/server';
import { getSession, clearSession, sameOrigin, setSealed, readSealed, hashState, pendingCookie, fiveMinutes, type PendingFlows } from '@/lib/session';
import { backend, BackendError } from '@/lib/backend';
import { uuidPattern, providers, meetingStatuses, type AuditEvent, type CalendarConnection, type Meeting, type MeetingStatus, type Provider, type Workspace } from '@/lib/contracts';

const json = (body: unknown, status = 200) => NextResponse.json(body, {status, headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const failure = (error: unknown, message: string) => {
  const status = error instanceof BackendError ? error.status : 503;
  return {status, body:{error: status === 403 ? 'You no longer have access here.' : status === 404 ? 'This is unavailable.' : message}};
};
const workspacePath = (segments: string[]) => uuidPattern.test(segments[1] ?? '') ? `/workspaces/${segments[1]}` : null;

/** Follows every page so existing connections are never silently omitted. */
async function allConnections(path: string, token: string) {
  const rows: CalendarConnection[] = [];
  let cursor: string | null = null;
  for (let request = 0; request < 20; request++) {
    const query = new URLSearchParams({limit:'100'});
    if (cursor) query.set('cursor', cursor);
    const body = await backend<{items:CalendarConnection[];nextCursor:string|null}>(`${path}?${query.toString()}`, {token});
    rows.push(...(body.items ?? []));
    cursor = body.nextCursor ?? null;
    if (!cursor) break;
  }
  return rows;
}


/** Only the fields the organizer page is allowed to show. Anything else the backend adds stays server-side. */
function meetingProjection(row: Record<string, unknown>): Meeting {
  const status = meetingStatuses.includes(row.status as MeetingStatus) ? row.status as MeetingStatus : 'PENDING';
  const optional = (value: unknown) => typeof value === 'string' && value ? value : null;
  return {
    id: String(row.id ?? ''),
    purpose: typeof row.purpose === 'string' ? row.purpose : '',
    startsAt: String(row.startsAt ?? ''),
    endsAt: String(row.endsAt ?? ''),
    timezone: typeof row.timezone === 'string' ? row.timezone : 'UTC',
    status,
    provider: providers.includes(row.provider as Provider) ? row.provider as Provider : null,
    joinUrl: safeJoinUrl(row.joinUrl),
    physicalLocation: optional(row.physicalLocation),
    agenda: optional(row.agenda),
    errorCode: optional(row.errorCode),
  };
}

/** An invite link must be an https Caffriend /meet URL and nothing else. */
function safeJoinUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^\/meet\/[A-Za-z0-9_-]{43}$/.test(url.pathname) && !url.username && !url.password
      ? url.toString() : null;
  } catch { return null; }
}

const validZone = (zone: string) => {
  try { new Intl.DateTimeFormat('en', {timeZone: zone}).format(); return true; } catch { return false; }
};
const validInterval = (startsAt: unknown, endsAt: unknown) =>
  typeof startsAt === 'string' && typeof endsAt === 'string' &&
  Number.isFinite(Date.parse(startsAt)) && Number.isFinite(Date.parse(endsAt)) &&
  Date.parse(endsAt) > Date.parse(startsAt) && Date.parse(endsAt) - Date.parse(startsAt) <= 86400000;

/**
 * The backend's audit list cannot filter by target, so pages are followed and filtered here.
 * Bounded so one meeting's history can never walk the whole workspace log.
 */
async function meetingAudit(workspace: string, meetingId: string, token: string) {
  const rows: AuditEvent[] = [];
  let cursor: string | null = null;
  for (let request = 0; request < 20 && rows.length < 50; request++) {
    const query = new URLSearchParams({limit:'100'});
    if (cursor) query.set('cursor', cursor);
    const body = await backend<{items:AuditEvent[];nextCursor:string|null}>(`${workspace}/audit-events?${query.toString()}`, {token});
    for (const row of body.items ?? [])
      if (row.targetType === 'Meeting' && row.targetId === meetingId)
        rows.push({id:row.id, createdAt:row.createdAt, action:row.action, actorType:row.actorType, targetType:row.targetType, targetId:row.targetId});
    cursor = body.nextCursor ?? null;
    if (!cursor) break;
  }
  return rows;
}

export async function GET(_request: Request, {params}:{params:Promise<{segments:string[]}>}) {
  const session = await getSession();
  if (!session) return json({error:'Sign in required'}, 401);
  const segments = (await params).segments;
  const path = segments.join('/');
  const workspace = workspacePath(segments);
  try {
    if (path === 'workspaces') return json(await backend<Workspace[]>('/workspaces', {token:session.token}));
    if (workspace && segments[2] === 'calendar-connections') {
      if (segments.length === 3) return json(await allConnections(`${workspace}/calendar-connections`, session.token));
      if (segments.length === 4 && segments[3] === 'status') return json(await backend(`${workspace}/calendar-connections/status`, {token:session.token}));
      if (segments.length === 5 && segments[4] === 'calendars' && uuidPattern.test(segments[3]))
        return json(await backend(`${workspace}/calendar-connections/${segments[3]}/calendars`, {token:session.token}));
    }
    if (workspace && segments[2] === 'meetings' && segments.length === 4 && uuidPattern.test(segments[3]))
      return json(meetingProjection(await backend<Record<string, unknown>>(`${workspace}/meetings/${segments[3]}`, {token:session.token})));
    if (workspace && segments[2] === 'meetings' && segments.length === 5 && segments[4] === 'audit' && uuidPattern.test(segments[3]))
      return json(await meetingAudit(workspace, segments[3], session.token));
    return json({error:'Not found'}, 404);
  } catch (error) {
    const {status, body} = failure(error, 'Unable to load this right now.');
    if (status === 401) await clearSession();
    return json(body, status);
  }
}

export async function POST(request: Request, {params}:{params:Promise<{segments:string[]}>}) {
  if (!sameOrigin(request)) return json({error:'Request not allowed'}, 403);
  const session = await getSession();
  if (!session) return json({error:'Sign in required'}, 401);
  const segments = (await params).segments;
  const path = segments.join('/');
  const workspace = workspacePath(segments);
  const key = request.headers.get('x-idempotency-key');
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    if (path === 'workspaces') {
      const name = body.name;
      if (typeof name !== 'string' || !name.trim() || name.length > 200) return json({error:'Enter a workspace name of up to 200 characters.'}, 400);
      return json(await backend('/workspaces', {token:session.token, method:'POST', body:{name:name.trim()}}));
    }
    if (workspace && segments[2] === 'meetings' && segments.length === 5 && uuidPattern.test(segments[3])) {
      const target = `${workspace}/meetings/${segments[3]}`;
      if (segments[4] === 'join-link') {
        const result = await backend<{joinUrl?:unknown}>(`${target}/join-link`, {token:session.token, method:'POST', body:{}});
        // The invite URL is issued by the server; this boundary never assembles one from a meeting id.
        const link = safeJoinUrl(result.joinUrl);
        return link ? json({joinUrl:link}) : json({error:'No invite link is available for this meeting.'}, 502);
      }
      if (segments[4] === 'reschedule') {
        const {startsAt, endsAt, timezone} = body as {startsAt?:unknown; endsAt?:unknown; timezone?:unknown};
        if (!validInterval(startsAt, endsAt) || typeof timezone !== 'string' || !validZone(timezone))
          return json({error:'Choose a valid start, end and timezone. The end must be after the start.'}, 400);
        return json(meetingProjection(await backend<Record<string, unknown>>(`${target}/reschedule`,
          {token:session.token, method:'POST', body:{startsAt, endsAt, timezone}})));
      }
      if (segments[4] === 'cancel')
        return json(meetingProjection(await backend<Record<string, unknown>>(`${target}/cancel`, {token:session.token, method:'POST', body:{}})));
    }
    if (workspace && segments[2] === 'calendar-connections' && segments.length === 5) {
      if (segments[4] === 'connect') return await connect(session.token, segments[1], segments[3]);
      if (!uuidPattern.test(segments[3])) return json({error:'Not found'}, 404);
      if (!key || !uuidPattern.test(key)) return json({error:'Request not allowed'}, 400);
      const target = `${workspace}/calendar-connections/${segments[3]}`;
      if (segments[4] === 'select') {
        if (typeof body.calendarId !== 'string' || !body.calendarId) return json({error:'Choose a calendar to continue.'}, 400);
        await backend(`${target}/select`, {token:session.token, method:'POST', body:{calendarId:body.calendarId}, key});
        return json(await allConnections(`${workspace}/calendar-connections`, session.token));
      }
      if (segments[4] === 'disconnect') {
        await backend(`${target}/disconnect`, {token:session.token, method:'POST', body:{}, key});
        return json(await allConnections(`${workspace}/calendar-connections`, session.token));
      }
    }
    return json({error:'Not found'}, 404);
  } catch (error) {
    const {status, body: problem} = failure(error, path === 'workspaces'
      ? 'Unable to create workspace. Refresh the workspace list before trying again.'
      : 'That did not complete. Check the connection below before trying again.');
    if (status === 401) await clearSession();
    return json(problem, status);
  }
}

/** Records a bounded pending flow per state so parallel tabs cannot be confused for one another. */
async function connect(token: string, workspaceId: string, provider: string) {
  if (!providers.includes(provider as Provider)) return json({error:'Not found'}, 404);
  const result = await backend<{redirect?:string}>(`/workspaces/${workspaceId}/calendar-connections/${provider}/connect`, {token, method:'POST', body:{}});
  let redirect: URL;
  try { redirect = new URL(result.redirect ?? ''); } catch { return json({error:'This provider is unavailable right now.'}, 502); }
  const expected = provider === 'GOOGLE' ? 'accounts.google.com' : 'login.microsoftonline.com';
  const state = redirect.searchParams.get('state');
  if (redirect.protocol !== 'https:' || redirect.hostname !== expected || !state) return json({error:'This provider is unavailable right now.'}, 502);
  const existing = (await readSealed<PendingFlows>(pendingCookie))?.flows ?? [];
  const cutoff = Date.now() - fiveMinutes * 1000;
  const flows = [...existing.filter(flow => flow.created > cutoff), {provider, workspaceId, stateHash: await hashState(state), created: Date.now()}].slice(-5);
  await setSealed(pendingCookie, {flows}, fiveMinutes);
  return json({redirect: redirect.toString()});
}
