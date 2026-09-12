import { NextResponse } from 'next/server';
import { getSession, readSealed, setSealed, clearCookie, hashState, pendingCookie, directPendingCookie, feedbackCookie, fiveMinutes, webOrigin, type PendingFlows } from '@/lib/session';
import { backend } from '@/lib/backend';
import { uuidPattern } from '@/lib/contracts';

const headers = {'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer'};
const to = (path: string) => NextResponse.redirect(new URL(path, webOrigin()), {status:303, headers});
function readDirectPending(request: Request): PendingFlows | null {
  const direct = request.headers.get('cookie')?.split(';').map(item=>item.trim()).find(item=>item.startsWith(`${directPendingCookie}=`))?.slice(directPendingCookie.length+1);
  if (!direct) return null;
  try { return JSON.parse(decodeURIComponent(direct)) as PendingFlows; } catch { return null; }
}

/**
 * The mailbox grant returns here rather than to the API, so the person ends up back
 * in Settings instead of looking at the backend's JSON. Same shape as the calendar
 * callback: the pending flow is validated and consumed here, the exchange itself
 * still happens in the backend, and the authorization code never reaches the browser
 * or survives the redirect.
 */
export async function GET(request: Request, {params}:{params:Promise<{provider:string}>}) {
  const provider = (await params).provider.toUpperCase();
  const query = new URL(request.url).searchParams;
  const state = query.get('state');
  const code = query.get('code');
  const denied = query.get('error');

  const directPending = readDirectPending(request);
  const pending = [...((await readSealed<PendingFlows>(pendingCookie))?.flows ?? []), ...(directPending?.flows ?? [])];
  const cutoff = Date.now() - fiveMinutes * 1000;
  const hash = state ? await hashState(state) : null;
  const flow = hash ? pending.find(item => item.stateHash === hash && item.created > cutoff) : undefined;
  const remaining = pending.filter(item => item !== flow && item.created > cutoff);
  if (remaining.length) await setSealed(pendingCookie, {flows: remaining}, fiveMinutes);
  else await clearCookie(pendingCookie);
  await clearCookie(directPendingCookie);

  // A mail state must not be redeemable through the calendar callback, or the reverse.
  if (!flow || provider !== 'GOOGLE' || flow.provider !== 'GOOGLE_MAIL' || !uuidPattern.test(flow.workspaceId)) {
    await setSealed(feedbackCookie, {outcome:'invalid'}, 60);
    return to('/app');
  }
  const settings = `/app/${flow.workspaceId}/settings`;

  const session = await getSession();
  if (!session) {
    await setSealed(feedbackCookie, {outcome:'session', provider}, fiveMinutes);
    return to(`/login?returnTo=${encodeURIComponent(settings)}`);
  }
  if (denied || !code) {
    await setSealed(feedbackCookie, {outcome: denied === 'access_denied' ? 'mail_cancelled' : 'denied', provider}, 60);
    return to(settings);
  }
  try {
    const result = await backend<{canSend?:boolean; senderAddress?:string}>(
      `/crm-outreach/mail-callback/${provider}?state=${encodeURIComponent(state!)}&code=${encodeURIComponent(code)}`,
      {token: session.token});
    await setSealed(feedbackCookie, {outcome: result.canSend ? 'mail_connected' : 'mail_failed', provider, detail: result.senderAddress}, 60);
  } catch {
    await setSealed(feedbackCookie, {outcome:'mail_failed', provider}, 60);
  }
  return to(settings);
}
