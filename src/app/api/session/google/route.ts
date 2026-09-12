import { NextResponse } from 'next/server';
import { backend, BackendError } from '@/lib/backend';
import { sameOrigin, saveSession } from '@/lib/session';

/**
 * Sign in, or create an account, with Google.
 *
 * `POST /user/social/google` is one endpoint for both: it returns the existing
 * account for that Google identity, adopts one already registered with the same
 * address, or creates a new one. The browser only ever holds the Google ID
 * token; the Caffriend token it is exchanged for is sealed into the session
 * cookie here and never reaches the page.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({error:'Request not allowed'}, {status:403});
  try {
    const {idToken} = await request.json();
    // Google ID tokens are compact JWTs; anything else is not worth forwarding.
    if (typeof idToken !== 'string' || !idToken || idToken.length > 4096) {
      return NextResponse.json({error:'Sign in with Google could not be completed.'}, {status:400});
    }
    const result = await backend<{success:boolean; data:{token:string; user:{id:string; firstName?:string; email?:string; isNew?:boolean}}}>(
      '/user/social/google', {method:'POST', body:{idToken}});
    if (!result.success || !result.data?.token || !result.data.user?.id) throw new BackendError(401);
    await saveSession(result.data.token, {id: result.data.user.id, name: result.data.user.firstName || 'Caffriend user'});
    // `isNew` lets the page say whether an account was created or signed in to.
    return NextResponse.json({ok:true, isNew: result.data.user.isNew === true, email: result.data.user.email ?? null},
      {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return NextResponse.json(
      {error: status === 400 || status === 401 ? 'Google could not verify that sign-in. Try again.' : 'Sign in with Google is unavailable right now.'},
      {status, headers:{'Cache-Control':'no-store'}});
  }
}
