import { NextResponse } from 'next/server';
import { getSession, readSealed, setSealed, clearCookie, hashState, pendingCookie, feedbackCookie, fiveMinutes, webOrigin, type PendingFlows } from '@/lib/session';
import { backend } from '@/lib/backend';
import { providers, uuidPattern, type Provider } from '@/lib/contracts';

const headers = {'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer'};
const to = (path: string) => NextResponse.redirect(new URL(path, webOrigin()), {status:303, headers});

/**
 * Providers redirect here. The frontend validates its own pending flow and relays state and code
 * server-to-server; the backend still validates state, ownership, expiry and PKCE and performs the
 * exchange. Codes are never rendered to the browser and never survive the redirect below.
 */
export async function GET(request: Request, {params}:{params:Promise<{provider:string}>}) {
  const provider = (await params).provider.toUpperCase();
  const query = new URL(request.url).searchParams;
  const state = query.get('state');
  const code = query.get('code');
  const denied = query.get('error');

  const pending = (await readSealed<PendingFlows>(pendingCookie))?.flows ?? [];
  const cutoff = Date.now() - fiveMinutes * 1000;
  const hash = state ? await hashState(state) : null;
  const flow = hash ? pending.find(item => item.stateHash === hash && item.created > cutoff) : undefined;
  // Each pending flow is consumed once, so a replayed callback finds nothing to match.
  const remaining = pending.filter(item => item !== flow && item.created > cutoff);
  if (remaining.length) await setSealed(pendingCookie, {flows: remaining}, fiveMinutes);
  else await clearCookie(pendingCookie);

  if (!flow || !providers.includes(provider as Provider) || flow.provider !== provider || !uuidPattern.test(flow.workspaceId)) {
    await setSealed(feedbackCookie, {outcome:'invalid'}, 60);
    return to('/app');
  }
  const settings = `/app/${flow.workspaceId}/settings`;

  const session = await getSession();
  if (!session) {
    // Only the validated non-secret destination is kept; the authorization code is discarded.
    await setSealed(feedbackCookie, {outcome:'session', provider}, fiveMinutes);
    return to(`/login?returnTo=${encodeURIComponent(settings)}`);
  }
  if (denied || !code) {
    // No code is relayed; the backend's unconsumed state simply expires.
    await setSealed(feedbackCookie, {outcome: denied === 'access_denied' ? 'cancelled' : 'denied', provider}, 60);
    return to(settings);
  }
  try {
    const result = await backend<{status?:string}>(`/crm-calendar/callback/${provider}?state=${encodeURIComponent(state!)}&code=${encodeURIComponent(code)}`, {token: session.token});
    await setSealed(feedbackCookie, {outcome: result.status === 'SELECT_CALENDAR' ? 'select' : 'connected', provider}, 60);
  } catch {
    await setSealed(feedbackCookie, {outcome:'failed', provider}, 60);
  }
  return to(settings);
}
