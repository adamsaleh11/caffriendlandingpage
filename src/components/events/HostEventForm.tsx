'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EventSummary } from '@/lib/events';
import { eventsApi, problemMessage } from './client';
import {DateTimePicker} from '@/components/ui/date-time-picker';
import {FormSelect} from '@/components/ui/form-select';

export default function HostEventForm(){
  const router=useRouter(); const [paid,setPaid]=useState(false); const [pending,setPending]=useState(false); const [error,setError]=useState('');
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setPending(true);setError('');const form=new FormData(event.currentTarget);try{const start=new Date(String(form.get('startsAt')));const price=paid?Math.round(Number(form.get('price'))*100):0;const created=await eventsApi<EventSummary>('create',{method:'POST',body:JSON.stringify({title:form.get('title'),description:form.get('description'),startsAt:start.toISOString(),capacity:Number(form.get('capacity')),listed:form.get('listed')==='on',priceCents:price,spotlightTurnMs:Number(form.get('spotlightTurnMs'))})});router.push(`/events/${created.id}`);}catch(problem){setError(problemMessage(problem));setPending(false);}}
  return <main className="host-event-page"><header className="event-detail-nav"><Link href="/events" className="events-brand">caffriend</Link><Link href="/events">Cancel</Link></header>
    <div className="host-event-layout"><section><p className="event-kicker">HOST ON DESKTOP</p><h1>Make room for a good conversation.</h1><p>Set the occasion. Caffriend will rank the room separately for every attendee.</p></section>
    <form className="host-event-form" onSubmit={submit}><label>Event title<input name="title" required maxLength={200} autoFocus placeholder="Designers building in public"/></label><label>Description<textarea name="description" maxLength={2000} rows={5} placeholder="What will bring this room together?"/></label>
      <div className="form-row"><div className="field"><span className="field-label">Starts at</span><DateTimePicker name="startsAt" aria-label="Starts at" required/></div><label>Capacity<input name="capacity" type="number" min="1" max="50" defaultValue="50" required/></label></div>
      <fieldset><legend>Admission</legend><label className="choice"><input type="radio" name="admission" checked={!paid} onChange={()=>setPaid(false)}/>Free</label><label className="choice"><input type="radio" name="admission" checked={paid} onChange={()=>setPaid(true)}/>Paid</label>{paid&&<label>Price in CAD<input name="price" type="number" min="1" step="0.01" required/></label>}</fieldset>
      <div className="field"><span className="field-label">Spotlight turns</span><FormSelect name="spotlightTurnMs" aria-label="Spotlight turns" defaultValue="60000" options={[{value:'30000',label:'30 seconds'},{value:'60000',label:'1 minute'},{value:'90000',label:'90 seconds'}]} /></div>
      <label className="choice"><input name="listed" type="checkbox" defaultChecked/>List this event in public discovery</label>
      {paid&&<p role="note" className="form-note">The current BE-4 contract stores a price but does not yet create event checkout. Paid registration will remain unavailable until that server contract lands.</p>}
      {error&&<p role="alert">{error}</p>}<button disabled={pending}>{pending?'Creating event…':'Create event'}</button>
    </form></div></main>;
}
