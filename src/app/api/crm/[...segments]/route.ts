import { NextResponse } from 'next/server';
import { getSession, clearSession, sameOrigin, setSealed, readSealed, hashState, pendingCookie, fiveMinutes, type PendingFlows } from '@/lib/session';
import { backend, BackendError } from '@/lib/backend';
import { isResource, project, projectPage } from '@/lib/crm-projection';
import { writableResources, archivableResources, approvalActions } from '@/lib/contracts';
import { uuidPattern, providers, meetingStatuses, type AuditEvent, type CalendarConnection, type Meeting, type MeetingStatus, type Provider, type Workspace } from '@/lib/contracts';
import { projectCall } from '@/lib/app-projection';

const json = (body: unknown, status = 200) => NextResponse.json(body, {status, headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const failure = (error: unknown, message: string) => {
  const status = error instanceof BackendError ? error.status : 503;
  return {status, body:{error:
    status === 403 ? 'You no longer have access here.' :
    status === 404 ? 'This is unavailable.' :
    // A conflict means someone or something else changed this first, which is a
    // different problem from a failed save and needs a different instruction.
    status === 409 ? 'Someone else changed this first, so your change was not applied. The latest version is shown.' :
    message}};
};
const workspacePath = (segments: string[]) => uuidPattern.test(segments[1] ?? '') ? `/workspaces/${segments[1]}` : null;

/** Only the list arguments the backend accepts. It rejects any unknown query field outright. */
function listQuery(request: Request) {
  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const name of ['cursor', 'limit', 'search', 'pipelineId']) {
    const value = incoming.get(name);
    if (value) query.set(name, value);
  }
  return query.toString() ? `?${query.toString()}` : '';
}

/** Every CRM write is replayable, so a retry of the same submitted operation cannot duplicate it. */
const idempotent = (request: Request) => {
  const key = request.headers.get('x-idempotency-key');
  return key && uuidPattern.test(key) ? key : null;
};

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
    engagementId: optional(row.engagementId),
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
    const body = await backend<{items:AuditEvent[];nextCursor:string|null}>(`${workspace}/crm/audit-events?${query.toString()}`, {token});
    for (const row of body.items ?? [])
      if (row.targetType === 'Meeting' && row.targetId === meetingId)
        rows.push({id:row.id, createdAt:row.createdAt, action:row.action, actorType:row.actorType, targetType:row.targetType, targetId:row.targetId});
    cursor = body.nextCursor ?? null;
    if (!cursor) break;
  }
  return rows;
}

export async function GET(request: Request, {params}:{params:Promise<{segments:string[]}>}) {
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
    if (workspace && segments[2] === 'mail-connections' && segments.length === 4 && uuidPattern.test(segments[3]))
      return json(await backend(`${workspace}/mail-connections/${segments[3]}`, {token:session.token}));
    if (workspace && segments[2] === 'upcoming-calls' && segments.length === 3) {
      const result = await backend<unknown>('/calendar/accepted-events/1', {token:session.token});
      const value = result as {data?:unknown};
      const rows = Array.isArray(value?.data) ? value.data : Array.isArray(result) ? result : [];
      return json((rows as Record<string,unknown>[]).map(row=>projectCall(row,session.user.id)).filter(row=>!row.workspaceId||row.workspaceId===segments[1]));
    }
    if (workspace && segments[2] === 'meeting-outreach' && segments.length === 4 && uuidPattern.test(segments[3]))
      return json(await backend(`${workspace}/meeting-outreach/${segments[3]}`, {token:session.token}));
    if (workspace && segments[2] === 'meetings' && segments.length === 4 && uuidPattern.test(segments[3]))
      return json(meetingProjection(await backend<Record<string, unknown>>(`${workspace}/meetings/${segments[3]}`, {token:session.token})));
    if (workspace && segments[2] === 'meetings' && segments.length === 5 && segments[4] === 'audit' && uuidPattern.test(segments[3]))
      return json(await meetingAudit(workspace, segments[3], session.token));
    if (workspace && segments[2] === 'meetings' && segments.length === 3)
      return json(projectPage('meetings', await backend(`${workspace}/meetings${listQuery(request)}`, {token:session.token})));
    if (workspace && segments[2] === 'calendar-connections' && segments.length === 5 && segments[4] === 'availability' && uuidPattern.test(segments[3])) {
      const incoming = new URL(request.url).searchParams;
      const range = new URLSearchParams({start: incoming.get('start') ?? '', end: incoming.get('end') ?? ''});
      // Only busy intervals cross this boundary. Titles and attendees of unrelated events never do.
      const body = await backend<{busy?:unknown}>(`${workspace}/calendar-connections/${segments[3]}/availability?${range}`, {token:session.token});
      const busy = Array.isArray(body.busy) ? body.busy.map(row => {
        const slot = (row ?? {}) as Record<string, unknown>;
        return {start: String(slot.start ?? ''), end: String(slot.end ?? '')};
      }) : [];
      return json({busy});
    }
    if (workspace && segments[2] === 'pipelines') {
      if (segments.length === 3) return json(await backend(`${workspace}/pipelines`, {token:session.token}));
      if (segments.length === 5 && segments[4] === 'stages' && uuidPattern.test(segments[3]))
        return json(await backend(`${workspace}/pipelines/${segments[3]}/stages`, {token:session.token}));
    }
    if (workspace && segments[2] === 'oauth' && segments[3] === 'connections' && segments.length === 4)
      return json(await backend(`${workspace}/oauth/connections${listQuery(request)}`, {token:session.token}));
    const resource = segments[3] ?? '';
    if (workspace && segments[2] === 'crm' && isResource(resource)) {
      if (segments.length === 4)
        return json(projectPage(resource, await backend(`${workspace}/crm/${resource}${listQuery(request)}`, {token:session.token})));
      if (segments.length === 5 && uuidPattern.test(segments[4]))
        return json(project(resource, await backend(`${workspace}/crm/${resource}/${segments[4]}`, {token:session.token})));
      // What a person may actually be used for, decided by the server from reviewed claims.
      if (segments.length === 6 && resource === 'people' && segments[5] === 'permissions' && uuidPattern.test(segments[4]))
        return json(await backend(`${workspace}/crm/people/${segments[4]}/permissions`, {token:session.token}));
    }
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
    if (workspace && segments[2] === 'mail-connections' && segments.length === 5 && uuidPattern.test(segments[3])) {
      if (segments[4] === 'connect') {
        const result = await backend<{redirect?:string}>(`${workspace}/mail-connections/${segments[3]}/connect`, {token:session.token, method:'POST', body:{}});
        let redirect: URL;
        try { redirect = new URL(result.redirect ?? ''); } catch { return json({error:'Mailbox authorization is unavailable right now.'}, 502); }
        const state = redirect.searchParams.get('state');
        if (redirect.protocol !== 'https:' || !['accounts.google.com','login.microsoftonline.com'].includes(redirect.hostname) || !state)
          return json({error:'Mailbox authorization is unavailable right now.'}, 502);
        // Remembered for the same reason the calendar flow remembers its own: the
        // callback has to know which workspace to return the person to, and a
        // replayed state must find nothing waiting for it.
        const existing = (await readSealed<PendingFlows>(pendingCookie))?.flows ?? [];
        const cutoff = Date.now() - fiveMinutes * 1000;
        const flows = [...existing.filter(flow => flow.created > cutoff), {provider:'GOOGLE_MAIL', workspaceId:segments[1], stateHash: await hashState(state), created: Date.now()}].slice(-5);
        await setSealed(pendingCookie, {flows}, fiveMinutes);
        return json({redirect:redirect.toString()});
      }
      if (segments[4] === 'revoke')
        return json(await backend(`${workspace}/mail-connections/${segments[3]}/revoke`, {token:session.token, method:'POST', body:{}}));
    }
    if (workspace && segments[2] === 'meeting-outreach') {
      if (segments.length === 4 && segments[3] === 'preview')
        return json(await backend(`${workspace}/meeting-outreach/preview`, {token:session.token, method:'POST', body}));
      if (segments.length === 3) {
        if (!key || !uuidPattern.test(key)) return json({error:'Request not allowed'}, 400);
        return json(await backend(`${workspace}/meeting-outreach`, {token:session.token, method:'POST', body, key}));
      }
    }
    if (workspace && segments[2] === 'crm' && segments.length >= 4) {
      if (!key) return json({error:'Request not allowed'}, 400);
      const resource = segments[3];
      // Proposals are how an agent asks; they are never applied by this call.
      if (resource === 'proposals' && segments.length === 5 && (approvalActions as readonly string[]).includes(segments[4]))
        return json(await backend(`${workspace}/crm/proposals/${segments[4]}`, {token:session.token, method:'POST', body, key}));
      if (resource === 'approvals' && segments.length === 6 && segments[5] === 'review' && uuidPattern.test(segments[4])) {
        const decision = body.decision;
        if (decision !== 'APPROVED' && decision !== 'REJECTED') return json({error:'Choose whether to approve or reject this proposal.'}, 400);
        // A rejection has to say why, so the requester and the audit trail both carry a reason.
        if (decision === 'REJECTED' && (typeof body.reason !== 'string' || !body.reason.trim()))
          return json({error:'Give a reason for rejecting this proposal.'}, 400);
        return json(await backend(`${workspace}/crm/approvals/${segments[4]}/review`, {token:session.token, method:'POST', body, key}));
      }
      if (resource === 'source-artifacts' && segments.length === 6 && segments[5] === 'rights-review' && uuidPattern.test(segments[4]))
        return json(project('source-artifacts', await backend(`${workspace}/crm/source-artifacts/${segments[4]}/rights-review`, {token:session.token, method:'POST', body, key})));
      if (segments.length === 4 && isResource(resource)) {
        if (!(writableResources as readonly string[]).includes(resource)) return json({error:'This record cannot be created here.'}, 403);
        return json(project(resource, await backend(`${workspace}/crm/${resource}`, {token:session.token, method:'POST', body, key})));
      }
    }
    if (workspace && segments[2] === 'pipelines') {
      if (!key) return json({error:'Request not allowed'}, 400);
      if (segments.length === 3) return json(await backend(`${workspace}/pipelines`, {token:session.token, method:'POST', body, key}));
      if (segments.length === 5 && segments[4] === 'stages' && uuidPattern.test(segments[3]))
        return json(await backend(`${workspace}/pipelines/${segments[3]}/stages`, {token:session.token, method:'POST', body, key}));
    }
    if (workspace && segments[2] === 'oauth') {
      if (!key) return json({error:'Request not allowed'}, 400);
      // The registration response carries the one-time credential. It is passed
      // straight to the caller and never stored, logged or cached at this boundary.
      if (segments.length === 4 && segments[3] === 'clients')
        return json(await backend(`${workspace}/oauth/clients`, {token:session.token, method:'POST', body, key}));
      if (segments.length === 6 && segments[3] === 'connections' && segments[5] === 'revoke' && uuidPattern.test(segments[4]))
        return json(await backend(`${workspace}/oauth/connections/${segments[4]}/revoke`, {token:session.token, method:'POST', body:{}, key}));
    }
    if (workspace && segments[2] === 'meetings' && segments.length === 3) {
      if (!key) return json({error:'Request not allowed'}, 400);
      return json(meetingProjection(await backend<Record<string, unknown>>(`${workspace}/meetings`, {token:session.token, method:'POST', body, key})));
    }
    if (workspace && segments[2] === 'meeting-proposals' && segments.length === 5 && segments[4] === 'confirm' && uuidPattern.test(segments[3])) {
      if (!key) return json({error:'Request not allowed'}, 400);
      return json(meetingProjection(await backend<Record<string, unknown>>(`${workspace}/meeting-proposals/${segments[3]}/confirm`, {token:session.token, method:'POST', body, key})));
    }
    if (workspace && segments[2] === 'meetings' && segments.length === 5 && segments[4] === 'retry' && uuidPattern.test(segments[3])) {
      if (!key) return json({error:'Request not allowed'}, 400);
      return json(meetingProjection(await backend<Record<string, unknown>>(`${workspace}/meetings/${segments[3]}/retry`, {token:session.token, method:'POST', body:{}, key})));
    }
    return json({error:'Not found'}, 404);
  } catch (error) {
    if (error instanceof BackendError && path.includes('meeting-outreach')) {
      const code = typeof error.body?.code === 'string' ? error.body.code : undefined;
      const message = typeof error.body?.message === 'string' ? error.body.message : 'The invitation was not sent.';
      return json({error:message, ...(code ? {code} : {})}, error.status);
    }
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

/** Shared preamble for every mutating verb below. */
async function guard(request: Request) {
  if (!sameOrigin(request)) return {problem: json({error:'Request not allowed'}, 403)};
  const session = await getSession();
  if (!session) return {problem: json({error:'Sign in required'}, 401)};
  const key = idempotent(request);
  if (!key) return {problem: json({error:'Request not allowed'}, 400)};
  return {session, key};
}

export async function PATCH(request: Request, {params}:{params:Promise<{segments:string[]}>}) {
  const checked = await guard(request);
  if (checked.problem) return checked.problem;
  const {session, key} = checked;
  const segments = (await params).segments;
  const workspace = workspacePath(segments);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    if (workspace && segments[2] === 'crm' && segments.length === 5 && uuidPattern.test(segments[4])) {
      const resource = segments[3];
      if (!isResource(resource) || !(writableResources as readonly string[]).includes(resource))
        return json({error:'This record cannot be edited here.'}, 403);
      return json(project(resource, await backend(`${workspace}/crm/${resource}/${segments[4]}`, {token:session!.token, method:'PATCH', body, key})));
    }
    if (workspace && segments[2] === 'pipelines') {
      if (segments.length === 4 && uuidPattern.test(segments[3]))
        return json(await backend(`${workspace}/pipelines/${segments[3]}`, {token:session!.token, method:'PATCH', body, key}));
      if (segments.length === 6 && segments[4] === 'stages' && uuidPattern.test(segments[3]) && uuidPattern.test(segments[5]))
        return json(await backend(`${workspace}/pipelines/${segments[3]}/stages/${segments[5]}`, {token:session!.token, method:'PATCH', body, key}));
    }
    return json({error:'Not found'}, 404);
  } catch (error) {
    const {status, body: problem} = failure(error, 'That change did not save. Reload before trying again.');
    if (status === 401) await clearSession();
    return json(problem, status);
  }
}

export async function PUT(request: Request, {params}:{params:Promise<{segments:string[]}>}) {
  const checked = await guard(request);
  if (checked.problem) return checked.problem;
  const {session, key} = checked;
  const segments = (await params).segments;
  const workspace = workspacePath(segments);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    if (workspace && segments[2] === 'pipelines' && segments.length === 6 && segments[4] === 'stages' && segments[5] === 'reorder' && uuidPattern.test(segments[3])) {
      const stageIds = body.stageIds;
      if (!Array.isArray(stageIds) || !stageIds.length || stageIds.some(id => typeof id !== 'string' || !uuidPattern.test(id)))
        return json({error:'The stage order could not be read. Reload the pipeline and try again.'}, 400);
      return json(await backend(`${workspace}/pipelines/${segments[3]}/stages/reorder`, {token:session!.token, method:'PUT', body:{stageIds}, key}));
    }
    return json({error:'Not found'}, 404);
  } catch (error) {
    const {status, body: problem} = failure(error, 'The new order did not save. Reload the pipeline before trying again.');
    if (status === 401) await clearSession();
    return json(problem, status);
  }
}

export async function DELETE(request: Request, {params}:{params:Promise<{segments:string[]}>}) {
  const checked = await guard(request);
  if (checked.problem) return checked.problem;
  const {session, key} = checked;
  const segments = (await params).segments;
  const workspace = workspacePath(segments);
  try {
    // Archival, not deletion: the backend soft-archives and the record stays auditable.
    if (workspace && segments[2] === 'crm' && segments.length === 5 && uuidPattern.test(segments[4])) {
      const resource = segments[3];
      if (!isResource(resource) || !(archivableResources as readonly string[]).includes(resource))
        return json({error:'This record cannot be archived here.'}, 403);
      return json(await backend(`${workspace}/crm/${resource}/${segments[4]}`, {token:session!.token, method:'DELETE', key}));
    }
    return json({error:'Not found'}, 404);
  } catch (error) {
    const {status, body: problem} = failure(error, 'That did not archive. Reload before trying again.');
    if (status === 401) await clearSession();
    return json(problem, status);
  }
}
