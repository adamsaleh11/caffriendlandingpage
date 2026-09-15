import { NextResponse } from 'next/server';
import { backend, BackendError } from '@/lib/backend';
import { sameOrigin, saveSession } from '@/lib/session';

type Signup = {firstName:string; lastName:string; email:string; password:string; countryCode:string; phoneNumber:string};

/** Trimmed, length-capped strings; anything else is not worth sending on. */
function read(body: Record<string, unknown>, key: keyof Signup, max: number) {
  const value = body[key];
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > max ? '' : trimmed;
}

/**
 * Create an account with an email and password.
 *
 * `POST /user/signup` creates the account and returns the same token shape the
 * login endpoint does, so the new account is signed in here immediately. The
 * backend owns the real rules — an address or phone number already registered
 * comes back as a 400 whose message is worth showing verbatim.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({error:'Request not allowed'}, {status:403});
  try {
    const body = await request.json() as Record<string, unknown>;
    const firstName = read(body,'firstName',80), lastName = read(body,'lastName',80);
    const email = read(body,'email',320).toLowerCase(), password = read(body,'password',1024);
    const countryCode = read(body,'countryCode',6), phoneNumber = read(body,'phoneNumber',20).replace(/[^\d]/g,'');
    if (!firstName || !lastName || !email || !email.includes('@') || password.length < 8 || !/^\+\d{1,4}$/.test(countryCode) || phoneNumber.length < 6) {
      return NextResponse.json({error:'Check your details — a name, a valid email, a phone number, and a password of at least 8 characters.'},{status:400});
    }
    const result = await backend<{success:boolean; data:{token:string; user:{id:string; firstName?:string}}}>(
      '/user/signup', {method:'POST', body:{firstName,lastName,email,password,countryCode,phoneNumber}});
    if (!result.success || !result.data?.token || !result.data.user?.id) throw new BackendError(502);
    await saveSession(result.data.token, {id: result.data.user.id, name: result.data.user.firstName || firstName});
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    const raw = error instanceof BackendError ? error.body?.message : undefined;
    const detail = Array.isArray(raw) ? raw[0] : raw;
    const message = status === 400 && typeof detail === 'string' && detail.length < 200 ? detail
      : status === 400 || status === 409 ? 'That account could not be created. Check your details and try again.'
      : 'Creating an account is unavailable right now. Please try again.';
    return NextResponse.json({error: message},{status: status === 409 ? 400 : status, headers:{'Cache-Control':'no-store'}});
  }
}
