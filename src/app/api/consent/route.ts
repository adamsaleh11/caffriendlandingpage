import { NextResponse } from 'next/server';
import { getSession, clearSession, readSealed, setSealed, clearCookie, consentCookie, fiveMinutes, webOrigin } from '@/lib/session';
import { backend, BackendError } from '@/lib/backend';

const back = (message: string) => NextResponse.redirect(new URL(`/oauth/authorize?problem=${message}`, webOrigin()), {status:303, headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});

/**
 * Plain form submission so the completed authorization redirect is delivered as a Location
 * header. The resulting code is never rendered into HTML or JSON for the web app.
 */
export async function POST(request: Request) {
  const site = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');
  // This page sends no referrer, so Chrome serialises the form's Origin as "null". The
  // authoritative check is the token sealed alongside the captured request below.
  if (site && site !== 'same-origin') return back('blocked');
  if (origin && origin !== 'null' && origin !== webOrigin()) return back('blocked');
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/login', webOrigin()), {status:303});
  const form = await request.formData();
  const captured = await readSealed<{request:string;csrf:string}>(consentCookie);
  const approved = form.get('decision') === 'allow';
  if (captured?.csrf && form.get('csrf') !== captured.csrf) return back('blocked');
  if (!captured?.request) {
    // Cancellation with no valid request exits locally rather than constructing a third-party redirect.
    await clearCookie(consentCookie);
    return back('expired');
  }
  const workspaceId = form.get('workspaceId');
  if (typeof workspaceId !== 'string' || !workspaceId) return back('invalid');
  try {
    const result = await backend<{redirect?:string}>('/oauth/consent', {token:session.token, method:'POST', body:{
      request: captured.request, workspaceId, approved, offlineConsent: form.get('offlineConsent') === 'on',
    }});
    let redirect: URL;
    try { redirect = new URL(result.redirect ?? ''); } catch { return back('failed'); }
    if (redirect.protocol !== 'https:') return back('failed');
    const response = NextResponse.redirect(redirect, {status:303, headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    response.cookies.set(consentCookie, '', {path:'/', maxAge:0});
    return response;
  } catch (error) {
    if (error instanceof BackendError && error.status === 401) { await clearSession(); return NextResponse.redirect(new URL('/login', webOrigin()), {status:303}); }
    await clearCookie(consentCookie);
    return back(approved ? 'failed' : 'cancelled');
  }
}

/** Captures the backend's opaque consent request, then returns to a clean consent URL. */
export async function GET(request: Request) {
  const incoming = new URL(request.url).searchParams.get('request');
  if (incoming) await setSealed(consentCookie, {request: incoming, csrf: crypto.randomUUID()}, fiveMinutes);
  else await clearCookie(consentCookie);
  return NextResponse.redirect(new URL('/oauth/authorize', webOrigin()), {status:303, headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
