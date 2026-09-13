'use client';
import { useCallback, useEffect, useState } from 'react';
import Gate from './Gate';

type Slot = {id:string; startsAt:string; endsAt:string};
type Sender = {displayName?:string; firstName?:string; lastName?:string; jobTitle?:string; company?:string};
type View = {recipientEmail?:string; purpose:string; message:string; timezone:string; conference?:string; decision:'PENDING'|'ACCEPTED'|'DECLINED'; sender:Sender; slots:Slot[]; unavailable?:boolean; joinUrl?:string|null};
type Intent = 'accept'|'decline';
const senderName = (sender: Sender) => sender.displayName || [sender.firstName,sender.lastName].filter(Boolean).join(' ') || 'Your host';

export default function Invitation({token,initialIntent,signedIn,googleClientId}:{token:string;initialIntent?:Intent;signedIn?:boolean;googleClientId?:string}) {
  const [view,setView]=useState<View>(); const [intent,setIntent]=useState<Intent|undefined>(initialIntent);
  const [slotId,setSlotId]=useState(''); const [problem,setProblem]=useState(''); const [loading,setLoading]=useState(true); const [pending,setPending]=useState(false); const [attempt,setAttempt]=useState(0);
  // Someone already signed in has nothing to choose; everyone else decides
  // between bringing an account and staying a guest before they book.
  const [identified,setIdentified]=useState(signedIn===true);
  // `identified` is also true for a guest who chose to stay one; `hasAccount`
  // is what decides whether this booking becomes a connection.
  const [hasAccount,setHasAccount]=useState(signedIn===true);
  const [created,setCreated]=useState(false);
  const signedInHere=useCallback((wasCreated:boolean)=>{setCreated(wasCreated);setHasAccount(true);setIdentified(true);},[]);
  useEffect(()=>{ const controller=new AbortController(); setLoading(true); setProblem('');
    fetch('/api/invitation/resolve',{method:'POST',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','X-Caffriend-Request':'1'},body:JSON.stringify({token})})
      .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error);return body as View;})
      .then(setView).catch(error=>{if(!controller.signal.aborted)setProblem(error instanceof Error?error.message:'Invitation unavailable.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort(); },[token,attempt]);
  async function decide(){ if(!intent||(intent==='accept'&&!slotId))return; setPending(true);setProblem('');
    try{const response=await fetch('/api/invitation/decide',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Caffriend-Request':'1'},body:JSON.stringify({token,decision:intent==='accept'?'ACCEPTED':'DECLINED',...(intent==='accept'?{slotId}:{})})});const body=await response.json();if(!response.ok)throw new Error(body.error);const next=(body.view??body) as View;setView(next);if(next.unavailable){setSlotId('');setProblem('That time is no longer available. Choose another proposed time.');}}
    catch(error){setProblem(error instanceof Error?error.message:'Your response was not saved.');}finally{setPending(false);}}
  if(loading)return <main className="invitation-page"><section className="invitation-card"><p role="status">Loading your invitation…</p></section></main>;
  if(!view)return <main className="invitation-page"><section className="invitation-card"><h1>Invitation unavailable</h1><p role="alert">{problem}</p><button onClick={()=>setAttempt(value=>value+1)}>Try again</button></section></main>;
  if(view.decision!=='PENDING')return <main className="invitation-page"><section className="invitation-card"><p className="invitation-mark">Caffriend</p><h1>{view.decision==='ACCEPTED'?'Your coffee chat is booked':'Invitation declined'}</h1><p>{view.decision==='ACCEPTED'?'A confirmation email with your join button is on its way.':'Your response has been sent to the host.'}</p>{view.decision==='ACCEPTED'&&hasAccount&&<p className="notice">{created?`Your account is ready, and you and ${senderName(view.sender)} are now connected on Caffriend.`:`You and ${senderName(view.sender)} are now connected on Caffriend.`} This chat is on your Caffriend calendar, and the calendar invitation lands in your inbox.</p>}
    {view.decision==='ACCEPTED'&&!hasAccount&&<p className="small">You booked as a guest, so the chat is not on a Caffriend calendar. Everything you need to join is in the confirmation email.</p>}</section></main>;
  if(!identified)return <main className="invitation-page"><section className="invitation-card">
    <p className="invitation-mark">Caffriend</p>
    <Gate host={senderName(view.sender)} email={view.recipientEmail} clientId={googleClientId}
      onGuest={()=>setIdentified(true)} onSignedIn={signedInHere}/>
  </section></main>;
  return <main className="invitation-page"><section className="invitation-card">
    <p className="invitation-mark">Caffriend</p><p className="eyebrow">Invitation from {senderName(view.sender)}</p><h1>{view.purpose}</h1>{view.message&&<p className="invitation-message">{view.message}</p>}
    <dl className="invitation-facts"><dt>Where</dt><dd>{view.conference||'Caffriend call'}</dd><dt>Times shown in</dt><dd>{view.timezone}</dd></dl>
    <div className="invitation-actions" role="group" aria-label="Your response"><button className={intent==='accept'?'selected':''} aria-pressed={intent==='accept'} onClick={()=>setIntent('accept')}>Accept</button><button className={`secondary ${intent==='decline'?'selected':''}`} aria-pressed={intent==='decline'} onClick={()=>setIntent('decline')}>Decline</button></div>
    {intent==='accept'&&<fieldset><legend>Choose one proposed time</legend>{view.slots.length?view.slots.map(slot=><label className="invitation-slot" key={slot.id}><input type="radio" name="slot" value={slot.id} checked={slotId===slot.id} onChange={()=>setSlotId(slot.id)}/><span><strong>{new Date(slot.startsAt).toLocaleString(undefined,{dateStyle:'full',timeStyle:'short'})}</strong><small> until {new Date(slot.endsAt).toLocaleTimeString(undefined,{timeStyle:'short'})}</small></span></label>):<p role="note">No proposed times remain available. Contact the host for another time.</p>}</fieldset>}
    {intent==='decline'&&<p role="note">The host will be told that you cannot make these times.</p>}{problem&&<p role="alert">{problem}</p>}
    {intent&&<button className="decision-button" disabled={pending||(intent==='accept'&&!slotId)} onClick={decide}>{pending?'Saving…':intent==='accept'?'Confirm time':'Decline invitation'}</button>}
  </section></main>;
}
