import { NextResponse } from 'next/server';
import { getSession, sameOrigin } from '@/lib/session';

export async function POST(request: Request) {
  if(!sameOrigin(request)) return NextResponse.json({error:'Request not allowed'}, {status:403});
  const session = await getSession();
  if(!session) return NextResponse.json({error:'Sign in required'}, {status:401, headers:{'Cache-Control':'no-store'}});
  return NextResponse.json({token:session.token}, {headers:{'Cache-Control':'no-store'}});
}
