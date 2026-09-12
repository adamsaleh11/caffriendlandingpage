import { NextResponse } from 'next/server';
import { backend, BackendError } from '@/lib/backend';
import { sameOrigin } from '@/lib/session';

const json = (body: unknown, status = 200) => NextResponse.json(body, {status, headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});

export async function POST(request: Request, {params}:{params:Promise<{action:string}>}) {
  if (!sameOrigin(request)) return json({error:'Request not allowed'}, 403);
  const action = (await params).action;
  if (action !== 'resolve' && action !== 'decide') return json({error:'Not found'}, 404);
  const body = await request.json().catch(() => ({}));
  try {
    return json(await backend(`/meeting-invitations/${action}`, {method:'POST', body}));
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return json({error: status === 404 ? 'Invitation unavailable.' : status === 409 ? 'This invitation has already been answered.' : 'This invitation could not be updated. Please try again.'}, status);
  }
}
