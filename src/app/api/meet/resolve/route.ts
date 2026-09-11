import { NextResponse } from 'next/server';
import { backend, BackendError } from '@/lib/backend';
import { sameOrigin } from '@/lib/session';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Request not allowed.' }, 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) return json({ error: 'Invitation unavailable.' }, 404);
  try {
    const result = await backend<Record<string, unknown>>('/meetings/join/resolve', { method: 'POST', body: { token: body.token } });
    if (typeof result.purpose !== 'string' || typeof result.startsAt !== 'string' || typeof result.endsAt !== 'string' || typeof result.timezone !== 'string' || !Number.isFinite(Date.parse(result.startsAt)) || !Number.isFinite(Date.parse(result.endsAt))) return json({ error: 'Unable to load this invitation. Please try again.' }, 502);
    try { new Intl.DateTimeFormat('en', { timeZone: result.timezone }).format(); } catch { return json({ error: 'Unable to load this invitation. Please try again.' }, 502); }
    return json({ purpose: result.purpose, startsAt: result.startsAt, endsAt: result.endsAt, timezone: result.timezone });
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return json({ error: status === 404 ? 'Invitation unavailable.' : 'Unable to load this invitation. Please try again.' }, status);
  }
}
