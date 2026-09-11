import { NextResponse } from 'next/server';
import { backend, BackendError } from '@/lib/backend';
import { clearSession, feedbackCookie, readSealed, sameOrigin, saveSession } from '@/lib/session';
export async function POST(request: Request) {
  if(!sameOrigin(request)) return NextResponse.json({error:'Request not allowed'}, {status:403});
  try {
    const {email,password} = await request.json();
    if(typeof email !== 'string' || !email.trim() || email.length > 320 || typeof password !== 'string' || !password || password.length > 1024) return NextResponse.json({error:'Enter your email or phone number and password.'},{status:400});
    const result = await backend<{success:boolean;data:{token:string;user:{id:string;firstName?:string}}}>('/user/login',{method:'POST',body:{email:email.trim(),password}});
    if(!result.success || !result.data?.token || !result.data.user?.id) throw new BackendError(401);
    await saveSession(result.data.token,{id:result.data.user.id,name:result.data.user.firstName || 'Caffriend user'});
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    const status = error instanceof BackendError ? error.status : 503;
    return NextResponse.json({error:status===400 || status===401 ? 'Unable to sign in. Check your credentials and try again.' : 'Sign in is unavailable. Please try again.'},{status,headers:{'Cache-Control':'no-store'}});
  }
}

export async function DELETE(request: Request) {
  if(!sameOrigin(request)) return NextResponse.json({error:'Request not allowed'}, {status:403});
  await clearSession();
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}

/** Reports the short-lived, non-secret result of a provider return exactly once. */
export async function GET() {
  const feedback = await readSealed<{outcome:string;provider?:string}>(feedbackCookie);
  const response = NextResponse.json({feedback: feedback ?? null},{headers:{'Cache-Control':'no-store'}});
  if(feedback) response.cookies.set(feedbackCookie,'',{path:'/',maxAge:0});
  return response;
}
