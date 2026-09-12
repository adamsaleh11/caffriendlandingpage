import 'server-only';
import { cookies } from 'next/headers';
import { sealData, unsealData } from 'iron-session';
import type { User } from './contracts';
export type Session = { token: string; user: User; expires: number };
export const sessionCookie = 'caffriend_session';
export function webOrigin() {
  const url = new URL(process.env.CAFFRIEND_WEB_ORIGIN || 'http://localhost:3000');
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('HTTPS web origin required');
  return url.origin;
}
function password() {
  const key = process.env.CAFFRIEND_SESSION_SECRET;
  if (!key || key.length < 32) throw new Error('Session configuration unavailable');
  return key;
}
export const cookieOptions = () => ({ httpOnly: true, secure: webOrigin().startsWith('https:'), sameSite: 'lax' as const, path: '/' });
export async function seal(value: unknown, ttl: number) { return sealData(value, {password: password(), ttl}); }
export async function unseal<T>(value: string): Promise<T> { return unsealData<T>(value, {password: password()}); }
export async function getSession(): Promise<Session | null> {
  const value = (await cookies()).get(sessionCookie)?.value;
  if (!value) return null;
  let session: Session;
  try { session = await unseal<Session>(value); } catch { return null; }
  return session.token && session.user?.id && session.expires > Date.now() ? session : null;
}
export async function saveSession(token: string, user: User) {
  // The token comes only from the configured backend. Expiry decoding cannot grant identity.
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  const expires = Math.min(Date.now() + 8*3600_000, Number(claims.exp)*1000);
  if (!Number.isFinite(expires) || expires <= Date.now()) throw new Error('Invalid login expiry');
  const ttl = Math.floor((expires-Date.now())/1000);
  const value = await seal({token, user, expires}, ttl);
  if(value.length > 3800) throw new Error('Session exceeds cookie limit');
  (await cookies()).set(sessionCookie, value, {...cookieOptions(), maxAge:ttl});
}
export async function clearSession() {
  const jar = await cookies();
  for (const name of [sessionCookie, consentCookie, pendingCookie, feedbackCookie]) jar.set(name, '', {...cookieOptions(), maxAge:0});
}
export function sameOrigin(request: Request) {
  return request.headers.get('origin') === webOrigin() && request.headers.get('x-caffriend-request') === '1';
}

export const consentCookie = 'caffriend_consent';
export const pendingCookie = 'caffriend_calendar_pending';
export const directPendingCookie = 'caffriend_direct_calendar_pending';
export const feedbackCookie = 'caffriend_calendar_result';
export const fiveMinutes = 300;

export type PendingFlow = { provider: string; workspaceId: string; stateHash: string; created: number };
export type PendingFlows = { flows: PendingFlow[] };

/** Short-lived encrypted cookies used for flows that must survive a third-party redirect. */
export async function setSealed(name: string, value: unknown, ttl: number) {
  (await cookies()).set(name, await seal(value, ttl), { ...cookieOptions(), maxAge: ttl });
}
export async function readSealed<T>(name: string): Promise<T | null> {
  const raw = (await cookies()).get(name)?.value;
  if (!raw) return null;
  try { return await unseal<T>(raw); } catch { return null; }
}
export async function clearCookie(name: string) {
  (await cookies()).set(name, '', { ...cookieOptions(), maxAge: 0 });
}
export async function hashState(state: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(state));
  return Buffer.from(digest).toString('hex');
}
