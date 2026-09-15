import { NextResponse } from 'next/server';
import { getSession, clearSession, sameOrigin } from '@/lib/session';
import { backend, BackendError } from '@/lib/backend';
import { image, projectSuggestion, projectConnection, projectCall, projectRank, projectProfile, projectProfileDetail, profileEdit, projectPerson, type AppConnection } from '@/lib/app-projection';

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

/** The first https photo in a `/media/user/:id` list, in either shape the rows arrive in. */
const firstMediaUrl = (body: unknown): string | null => {
  for (const item of list(body)) {
    const raw = typeof item.url === 'string' ? item.url : typeof item.media_url === 'string' ? item.media_url : '';
    const url = image(raw);
    if (url) return url;
  }
  return null;
};

/** Fetches public profiles a few at a time; a row whose profile fails keeps its base fields. */
async function withProfiles<T extends {userId: string; image?: string | null}>(rows: T[], token: string): Promise<T[]> {
  const limit = 6;
  const out = [...rows];
  for (let start = 0; start < out.length; start += limit) {
    const slice = out.slice(start, start + limit);
    const details = await Promise.all(slice.map(row =>
      backend(`/user/profile/${encodeURIComponent(row.userId)}`, {token})
        .then(projectProfileDetail)
        .catch(() => null)));
    // Only fills in what the profile actually knows: a null there must not erase a
    // field the row already carried (a suggestion brings its own rating and matches).
    details.forEach((detail, index) => {
      if (!detail) return;
      for (const [key, value] of Object.entries(detail)) if (value !== null) (slice[index] as Record<string, unknown>)[key] = value;
    });
    // A person whose profile record carries no photo still has one in their media —
    // the same list the profile modal shows — so that is the last place to look.
    const faceless = slice.filter(row => !row.image);
    const photos = await Promise.all(faceless.map(row =>
      backend(`/media/user/${encodeURIComponent(row.userId)}`, {token})
        .then(body => firstMediaUrl(unwrap(body)))
        .catch(() => null)));
    photos.forEach((url, index) => { if (url) faceless[index].image = url; });
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

    /**
     * One person's public profile, for the profile modal.
     *
     * The same three reads the native public profile makes. Only the profile
     * itself is required: a person with no basic details or no separate media
     * still opens, with those sections absent rather than an error.
     */
    if (segments.length === 2 && segments[0] === 'person' && segments[1]) {
      const id = encodeURIComponent(segments[1]);
      const [profile, details, media] = await Promise.all([
        backend(`/user/profile/${id}`, {token:session.token}),
        backend(`/basic-details/answers/${id}`, {token:session.token}).catch(() => ({})),
        backend(`/media/user/${id}`, {token:session.token}).catch(() => []),
      ]);
      return json(projectPerson(unwrap(profile), unwrap(details), unwrap(media)));
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
      // Like Connections, `/match/suggestions` carries only a name, so each person's
      // public profile fills in job title, company, industry and location. A profile
      // that fails to load leaves that row with its base fields rather than the list.
      const items = await withProfiles(
        source.map(projectSuggestion).filter(row => row.userId && row.userId !== me), session.token);
      return json({
        items,
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

/** Re-reads the profile so an edit answers with the record the backend actually stored. */
const freshProfile = async (token: string) =>
  json(projectProfile(unwrap(await backend('/user/my-profile', {token}))));

/**
 * Profile edits.
 *
 * `me` writes the profile fields, `me/role` switches between mentee and mentor.
 * Both are the endpoints the native edit screen calls (`PUT /user/profile` and
 * `PUT /user/role`), so a change made here and one made in the app are the same
 * write. The response is a re-read rather than the write's own body, because
 * only some of these endpoints echo the updated record back.
 */
export async function PATCH(request: Request, {params}:{params:Promise<{segments:string[]}>}) {
  if (!sameOrigin(request)) return json({error:'Request not allowed'}, 403);
  const session = await getSession();
  if (!session) return json({error:'Sign in required'}, 401);
  const path = (await params).segments.join('/');
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    if (path === 'me') {
      const payload = profileEdit(body);
      if (!payload) return json({error:'Please check what you entered and try again.'}, 400);
      await backend('/user/profile', {token:session.token, method:'PUT', body:payload});
      return freshProfile(session.token);
    }

    if (path === 'me/role') {
      const role = String(body.role ?? '').toUpperCase();
      if (role !== 'MENTEE' && role !== 'MENTOR') return json({error:'Choose mentee or mentor.'}, 400);
      await backend('/user/role', {token:session.token, method:'PUT', body:{role}});
      return freshProfile(session.token);
    }
    return json({error:'Not found'}, 404);
  } catch (error) {
    const {status, body: problem} = failure(error);
    if (status === 401) await clearSession();
    return json(status === 400 ? {error:'That could not be saved.'} : problem, status);
  }
}

/** What `/media/upload` accepts, kept in step with the native photo picker. */
const IMAGE_TYPES = ['image/jpeg','image/png','image/webp','image/heic'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Adds one profile photo. Multipart, because `/media/upload` takes a file. */
export async function PUT(request: Request, {params}:{params:Promise<{segments:string[]}>}) {
  if (!sameOrigin(request)) return json({error:'Request not allowed'}, 403);
  const session = await getSession();
  if (!session) return json({error:'Sign in required'}, 401);
  const path = (await params).segments.join('/');
  if (path !== 'me/photo') return json({error:'Not found'}, 404);
  try {
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) return json({error:'Choose a photo first.'}, 400);
    if (!IMAGE_TYPES.includes(file.type)) return json({error:'Use a JPEG, PNG, WebP or HEIC image.'}, 400);
    if (file.size > MAX_IMAGE_BYTES) return json({error:'That image is larger than 8MB.'}, 400);
    // Only the file is forwarded; any other part the browser sent is dropped.
    const upload = new FormData();
    upload.append('file', file, file.name || 'photo.jpg');
    await backend('/media/upload', {token:session.token, method:'POST', body:upload});
    return freshProfile(session.token);
  } catch (error) {
    const {status, body: problem} = failure(error);
    if (status === 401) await clearSession();
    return json(status === 400 ? {error:'That photo could not be uploaded.'} : problem, status);
  }
}

/** Removes one profile photo. The backend checks the photo belongs to this person. */
export async function DELETE(request: Request, {params}:{params:Promise<{segments:string[]}>}) {
  if (!sameOrigin(request)) return json({error:'Request not allowed'}, 403);
  const session = await getSession();
  if (!session) return json({error:'Sign in required'}, 401);
  const segments = (await params).segments;
  if (segments.length !== 3 || segments[0] !== 'me' || segments[1] !== 'photo' || !segments[2]) return json({error:'Not found'}, 404);
  try {
    await backend(`/media/${encodeURIComponent(segments[2])}`, {token:session.token, method:'DELETE'});
    return freshProfile(session.token);
  } catch (error) {
    const {status, body: problem} = failure(error);
    if (status === 401) await clearSession();
    return json(problem, status);
  }
}
