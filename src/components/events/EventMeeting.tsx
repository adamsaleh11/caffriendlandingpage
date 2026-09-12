'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Call from '@/components/meet/Call';
import Preview, {type Devices} from '@/components/meet/Preview';
import type { EventCredentials, EventDetails, EventSummary } from '@/lib/events';
import { eventsApi, problemMessage } from './client';

export default function EventMeeting({eventId,displayName}:{eventId:string;displayName:string}){
  const [details,setDetails]=useState<EventDetails>(); const [isHost,setIsHost]=useState(false); const [error,setError]=useState(''); const [attempt,setAttempt]=useState(0);
  const [devices,setDevices]=useState<Devices>({audioInput:'',videoInput:''}); const [credentials,setCredentials]=useState<EventCredentials>(); const [joining,setJoining]=useState(false); const [left,setLeft]=useState(false);
  useEffect(()=>{let live=true;setError('');Promise.all([eventsApi<EventDetails>(eventId),eventsApi<EventSummary[]>('list').catch(()=>[])]).then(([event,rows])=>{if(live){setDetails(event);setIsHost(Boolean(rows.find(row=>row.id===eventId)?.isHost));}}).catch(problem=>{if(live)setError(problemMessage(problem));});return()=>{live=false;};},[eventId,attempt]);
  async function join(){setJoining(true);setError('');try{await eventsApi(`${eventId}/register`,{method:'POST',body:JSON.stringify({displayName})});const access=await eventsApi<EventCredentials>(`${eventId}/join`,{method:'POST',body:JSON.stringify({displayName})});setCredentials(access);}catch(problem){setError(problemMessage(problem));}finally{setJoining(false);}}
  return <main className="meeting-page event-call-page"><Link href="/events" className="meeting-brand">caffriend</Link><section className={`meeting-card ${credentials?'group-meeting-card':''}`}>
    {left?<><h1>You left the event</h1><p>Your camera and microphone are off.</p><a href={`/events/${eventId}`}>Back to the event</a></>
    :credentials&&details?<><div className="call-title"><p className="meeting-eyebrow">LIVE EVENT</p><h1>{details.title}</h1></div><Call {...credentials} devices={devices} leave={()=>{setCredentials(undefined);setLeft(true);}} event={{id:eventId,isHost}}/></>
    :error&&!details?<><h1>Event unavailable</h1><p role="alert">{error}</p><button onClick={()=>setAttempt(v=>v+1)}>Try again</button></>
    :!details?<p role="status">Loading event…</p>
    :<><p className="meeting-eyebrow">EVENT LOBBY</p><h1>{details.title}</h1><p>{details.description}</p><Preview devices={devices} onDevices={setDevices}/><p>You’ll enter as <strong>{displayName}</strong>. Your Caffriend profile and shared match reasons appear on your tile.</p>{error&&<p role="alert">{error}</p>}<button disabled={joining} onClick={join}>{joining?'Entering…':'Enter event'}</button></>}
  </section></main>;
}
