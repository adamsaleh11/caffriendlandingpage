'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { EventDetails, EventSummary } from '@/lib/events';
import { eventsApi, problemMessage } from './client';
import InviteGuests from './InviteGuests';

export default function EventDetail({eventId,signedIn,displayName}:{eventId:string;signedIn:boolean;displayName:string}){
  const [details,setDetails]=useState<EventDetails>(); const [listing,setListing]=useState<EventSummary>(); const [error,setError]=useState(''); const [attempt,setAttempt]=useState(0);
  const [registering,setRegistering]=useState(false); const [registered,setRegistered]=useState(false); const [actionError,setActionError]=useState('');
  useEffect(()=>{let live=true;setDetails(undefined);setError('');Promise.all([eventsApi<EventDetails>(eventId),eventsApi<EventSummary[]>('list').catch(()=>[])]).then(([event,all])=>{if(live){setDetails(event);setListing(all.find(row=>row.id===eventId));}}).catch(problem=>{if(live)setError(problemMessage(problem));});return()=>{live=false;};},[eventId,attempt]);
  const returnTo=useMemo(()=>encodeURIComponent(`/events/${eventId}`),[eventId]);
  async function register(){setRegistering(true);setActionError('');try{await eventsApi(`${eventId}/register`,{method:'POST',body:JSON.stringify({displayName})});setRegistered(true);}catch(problem){setActionError(problemMessage(problem));}finally{setRegistering(false);}}
  if(error)return <main className="event-detail-page"><Link href="/events" className="events-brand">caffriend</Link><section className="event-state" role="alert"><h1>Event unavailable</h1><p>{error}</p><button onClick={()=>setAttempt(v=>v+1)}>Try again</button></section></main>;
  if(!details)return <main className="event-detail-page"><Link href="/events" className="events-brand">caffriend</Link><p role="status" className="event-loading">Loading event…</p></main>;
  const paid=(listing?.priceCents??0)>0;
  const hosting=listing?.isHost===true;
  return <main className="event-detail-page"><header className="event-detail-nav"><Link href="/events" className="events-brand">caffriend</Link><Link href="/events">All events</Link></header>
    <article className="event-detail"><section><p className="event-kicker">CAFFRIEND EVENT</p><h1>{details.title}</h1><p className="event-lede">{details.description||'A hosted room for meeting people with something real in common.'}</p>
      <dl className="event-facts"><div><dt>When</dt><dd>{details.startsAt?new Intl.DateTimeFormat('en-CA',{dateStyle:'full',timeStyle:'short'}).format(new Date(details.startsAt)):'To be announced'}</dd></div><div><dt>Admission</dt><dd>{paid?new Intl.NumberFormat('en-CA',{style:'currency',currency:listing?.currency||'CAD'}).format((listing?.priceCents||0)/100):'Free'}</dd></div><div><dt>Room</dt><dd>Up to {listing?.capacity||50} people</dd></div></dl>
    </section><aside className="registration-card"><p className="event-kicker">{hosting?'HOST CONTROLS':'YOUR PLACE'}</p><h2>{hosting?'Your room is ready':registered?'You’re registered':'Join this room'}</h2>
      {hosting?<><p>Enter the room when you’re ready, and invite whoever should be in it.</p><Link className="event-button full" href={`/events/${eventId}/call`}>Start event</Link></>
      :registered?<><p>Your place is saved. The room opens from this page.</p><Link className="event-button full" href={`/events/${eventId}/call`}>Enter event</Link></>
      :paid?<><p>Paid registration needs the BE-4 event payment contract before checkout can be safely enabled.</p><button disabled>Registration unavailable</button></>
      :signedIn?<><p>Registration is free and reserves one attendee place.</p><button disabled={registering} onClick={register}>{registering?'Saving your place…':'Register'}</button></>
      :<><p>Sign in to reserve a place and see your ranked room.</p><Link className="event-button full" href={`/login?returnTo=${returnTo}`}>Sign in to register</Link></>}
      {actionError&&<p role="alert">{actionError}</p>}
      {hosting&&<InviteGuests eventId={eventId}/>}
    </aside></article>
  </main>;
}
