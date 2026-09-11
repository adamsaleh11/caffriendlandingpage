import { NextResponse } from 'next/server';
import { backend, BackendError } from '@/lib/backend';
import { sameOrigin } from '@/lib/session';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request not allowed.' }, 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) return json({ error: 'Invitation unavailable.' }, 404);
  if (typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.trim().length > 200) return json({ error: 'Enter your display name.' }, 400);
  if (body.acceptedTerms !== true) return json({ error: 'Accept the meeting and privacy terms before joining.' }, 403);
  try {
    const result = await backend<{ token: string; url: string }>('/meetings/join/token', { method: 'POST', body: { token: body.token, displayName: body.displayName.trim(), acceptedTerms: true } });
    const url = new URL(result.url);
    if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash || typeof result.token !== 'string' || !result.token) return json({ error: 'Calling is unavailable. Please try again.' }, 502);
    return json({ token: result.token, url: url.toString() });
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return json({ error: status === 404 ? 'Invitation unavailable.' : status === 403 ? 'This meeting is not open for joining. Check the invitation time or contact the organizer.' : status === 401 ? 'You are not authorized to join this meeting.' : 'Calling is unavailable. Please try again.' }, status);
  }
}
