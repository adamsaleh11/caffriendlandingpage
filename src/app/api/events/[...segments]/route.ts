import { NextResponse } from 'next/server';
import { backend, BackendError } from '@/lib/backend';
import { clearSession, getSession, sameOrigin } from '@/lib/session';
import { eventCapacity, type EventDetails, type EventSummary, type RosterMember, type SpotlightState } from '@/lib/events';

const json = (body:unknown, status=200) => NextResponse.json(body, {status, headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const platform = {'x-caffriend-platform':'desktop'};
const message = (status:number) => status === 401 ? 'Sign in required.' : status === 403 ? 'You do not have access to do that.' : status === 404 ? 'This event is unavailable.' : 'This could not be completed right now.';
const fail = async (error:unknown) => {
  const status = error instanceof BackendError ? error.status : 503;
  if (status === 401) await clearSession();
  return json({error:message(status)}, status);
};
const text = (value:unknown, max:number) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const summary = (row:Record<string,unknown>, viewerId?:string):EventSummary => ({
  id:String(row.id ?? ''), title:text(row.title,200), description:typeof row.description === 'string' ? row.description.slice(0,2000) : null,
  startsAt:typeof row.startsAt === 'string' && Number.isFinite(Date.parse(row.startsAt)) ? row.startsAt : null,
  listed:row.listed === true, priceCents:Number.isInteger(row.priceCents) ? Number(row.priceCents) : 0,
  currency:typeof row.currency === 'string' ? row.currency.toUpperCase() : 'CAD', status:row.status === 'ENDED' ? 'ENDED' : 'OPEN',
  capacity:eventCapacity, isHost:viewerId ? row.hostId === viewerId : undefined,
});

export async function GET(_request:Request, {params}:{params:Promise<{segments?:string[]}>}) {
  const segments=(await params).segments ?? [];
  const session=await getSession();
  try {
    if (!segments.length || segments[0] === 'list') {
      const rows=await backend<Record<string,unknown>[]>('/group-calls/events', {headers:platform});
      return json(Array.isArray(rows) ? rows.map(row=>summary(row,session?.user.id)) : []);
    }
    const [id, action]=segments;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({error:'This event is unavailable.'},404);
    if (!action) {
      const row=await backend<Record<string,unknown>>(`/group-calls/${id}/resolve`);
      const event:EventDetails={id:String(row.id),kind:'EVENT',title:text(row.title,200),description:typeof row.description==='string'?row.description.slice(0,2000):null,startsAt:typeof row.startsAt==='string'?row.startsAt:null,micOpenOnArrival:row.micOpenOnArrival===true};
      if (row.kind !== 'EVENT' || !event.title) return json({error:'This event is unavailable.'},404);
      return json(event);
    }
    if (action==='roster') {
      if (!session) return json({error:'Sign in required.'},401);
      const rows=await backend<RosterMember[]>(`/group-calls/${id}/roster`,{token:session.token});
      return json(Array.isArray(rows)?rows:[]);
    }
    if (action==='spotlight') return json(await backend<SpotlightState>(`/group-calls/${id}/spotlight`));
    return json({error:'Not found.'},404);
  } catch(error) { return fail(error); }
}

export async function POST(request:Request, {params}:{params:Promise<{segments?:string[]}>}) {
  if (!sameOrigin(request)) return json({error:'Request not allowed.'},403);
  const segments=(await params).segments ?? [];
  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const session=await getSession();
  if (!session) return json({error:'Sign in required.'},401);
  try {
    if (!segments.length || segments[0] === 'create') {
      const title=text(body.title,200), description=text(body.description,2000);
      const startsAt=typeof body.startsAt==='string' && Number.isFinite(Date.parse(body.startsAt)) ? body.startsAt : '';
      const capacity=Number(body.capacity);
      const priceCents=Number(body.priceCents);
      if (!title || !startsAt || !Number.isInteger(capacity) || capacity<1 || capacity>eventCapacity || !Number.isInteger(priceCents) || priceCents<0) return json({error:'Check the event details and try again.'},400);
      const created=await backend<Record<string,unknown>>('/group-calls',{token:session.token,method:'POST',headers:platform,body:{kind:'EVENT',title,description:description||undefined,startsAt,capacity,listed:body.listed===true,priceCents,spotlightTurnMs:[30000,60000,90000].includes(Number(body.spotlightTurnMs))?Number(body.spotlightTurnMs):60000,micOpenOnArrival:false}});
      return json(summary(created,session.user.id),201);
    }
    const [id, action, verb]=segments;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({error:'This event is unavailable.'},404);
    if (action==='register') return json(await backend(`/group-calls/${id}/register`,{token:session.token,method:'POST',headers:platform,body:{displayName:text(body.displayName,200)}}));
    if (action==='join') return json(await backend(`/group-calls/${id}/join`,{token:session.token,method:'POST',headers:platform,body:{displayName:text(body.displayName,200)}}));
    if (action==='connect') return json(await backend(`/group-calls/${id}/connect`,{token:session.token,method:'POST',body:{toUserId:body.toUserId}}));
    if (action==='spotlight' && verb==='start') return json(await backend(`/group-calls/${id}/spotlight/start`,{token:session.token,method:'POST',body:{turnMs:body.turnMs}}));
    if (action==='end') return json(await backend(`/group-calls/${id}/end`,{token:session.token,method:'POST',body:{}}));
    return json({error:'Not found.'},404);
  } catch(error) { return fail(error); }
}
