'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { EventSummary } from '@/lib/events';
import { eventsApi, problemMessage } from './client';

const money=(cents:number,currency:string)=>cents===0?'Free':new Intl.NumberFormat('en-CA',{style:'currency',currency}).format(cents/100);
const when=(value:string|null)=>value?new Intl.DateTimeFormat('en-CA',{dateStyle:'long',timeStyle:'short'}).format(new Date(value)):'Time to be announced';

export default function EventList(){
  const [events,setEvents]=useState<EventSummary[]>(); const [error,setError]=useState(''); const [attempt,setAttempt]=useState(0);
  useEffect(()=>{let live=true;setEvents(undefined);setError('');eventsApi<EventSummary[]>('list').then(rows=>{if(live)setEvents(rows);}).catch(problem=>{if(live)setError(problemMessage(problem));});return()=>{live=false;};},[attempt]);
  return <main className="events-page">
    <header className="events-header"><Link href="/" className="events-brand">caffriend</Link><nav aria-label="Event actions"><Link className="event-button secondary" href="/events/new">Host an event</Link><Link className="event-button" href="/home">My Caffriend</Link></nav></header>
    <section className="events-hero"><p className="event-kicker">LIVE CONNECTION, RANKED FOR YOU</p><h1>Rooms worth walking into.</h1><p>Join a hosted gathering, then meet the people Caffriend thinks you should know first.</p></section>
    <section aria-labelledby="upcoming-events" className="events-section"><div className="section-heading"><div><p className="event-kicker">DISCOVER</p><h2 id="upcoming-events">Upcoming events</h2></div></div>
      {!events&&!error&&<div className="event-grid" aria-label="Loading events"><div className="event-card skeleton"/><div className="event-card skeleton"/><div className="event-card skeleton"/></div>}
      {error&&<div className="event-state" role="alert"><h3>Events are taking a coffee break</h3><p>{error}</p><button onClick={()=>setAttempt(value=>value+1)}>Try again</button></div>}
      {events?.length===0&&<div className="event-state"><h3>Nothing is scheduled yet</h3><p>Be the first to bring a room together.</p><Link className="event-button" href="/events/new">Host an event</Link></div>}
      {events&&events.length>0&&<div className="event-grid">{events.map(event=><article className="event-card" key={event.id}>
        <div className="event-card-top"><span className="event-price">{money(event.priceCents,event.currency)}</span><span>{event.capacity} seats</span></div>
        <p className="event-date">{when(event.startsAt)}</p><h3><Link href={`/events/${event.id}`}>{event.title}</Link></h3><p>{event.description||'A Caffriend gathering for conversations that go somewhere.'}</p>
        <div className="event-card-action"><span>{event.status==='ENDED'?'Ended':'Registration open'}</span><Link aria-label={`View ${event.title}`} href={`/events/${event.id}`}>View event <span aria-hidden="true">↗</span></Link></div>
      </article>)}</div>}
    </section>
  </main>;
}
