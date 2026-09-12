'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { providers, providerNames, mailboxNames, type CalendarConnection, type CalendarOption, type Provider } from '@/lib/contracts';
import {FormSelect} from '@/components/ui/form-select';

type Status = Partial<Record<Provider, {configured:boolean; errorCode?:string|null}>>;
/** What the mail grant looks like for one calendar connection. */
type MailStatus = {connectionId:string; provider:Provider; canSend:boolean; senderAddress?:string; mailStatus:string};
const outcomes: Record<string,string> = {
  select: 'Connected. Choose the calendar Caffriend should use.',
  connected: 'Your calendar connection is up to date.',
  cancelled: 'You cancelled the connection. Nothing was connected.',
  denied: 'The provider did not complete the connection. Nothing was connected.',
  failed: 'The connection could not be completed. Try connecting again.',
  invalid: 'That connection link could not be verified. Start the connection again from Settings.',
  session: 'Your session had expired, so the connection was not completed. Connect again.',
  mail_connected: 'Caffriend can now send invitations from your address.',
  mail_cancelled: 'You cancelled the mailbox permission. Nothing was granted.',
  mail_failed: 'The mailbox permission could not be completed. Turn it on again to retry.',
};

/**
 * One setting, on or off. A switch rather than a checkbox because each of these
 * takes effect the moment it moves — there is no form to submit afterwards.
 */
function Switch({label,hint,checked,disabled,onChange}:{label:string;hint:string;checked:boolean;disabled?:boolean;onChange:(next:boolean)=>void}) {
  return <div className="switch-row">
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      className="switch" onClick={()=>onChange(!checked)}>
      <span className="switch-track" aria-hidden="true"><span className="switch-thumb"/></span>
      <span className="switch-text"><strong>{label}</strong><span className="small">{hint}</span></span>
    </button>
  </div>;
}

export default function Calendars({workspaceId}:{workspaceId:string}) {
  const [status,setStatus]=useState<Status>();
  const [connections,setConnections]=useState<CalendarConnection[]>();
  const [error,setError]=useState<string>();
  const [notice,setNotice]=useState<string>();
  const [busy,setBusy]=useState<string>();
  const [attempt,setAttempt]=useState(0);
  const [calendars,setCalendars]=useState<Record<string,CalendarOption[]|'error'>>({});
  const [mails,setMails]=useState<Record<string,MailStatus>>({});
  // Keyed by the action being confirmed, so the two toggles never share a prompt.
  const [confirming,setConfirming]=useState<string>();
  // A retry of the same submitted operation reuses its key; changed input gets a new one.
  const keys=useRef<Record<string,string>>({});
  const keyFor=(id:string)=>(keys.current[id] ??= crypto.randomUUID());

  const load=useCallback(async (signal?:AbortSignal)=>{
    try{
      const [statuses,rows]=await Promise.all([
        api<Status>(`workspaces/${workspaceId}/calendar-connections/status`,{signal}),
        api<CalendarConnection[]>(`workspaces/${workspaceId}/calendar-connections`,{signal}),
      ]);
      if(signal?.aborted)return;
      setStatus(statuses);setConnections(rows);setError(undefined);
    }catch(problem){if(!signal?.aborted&&problem instanceof ApiError)setError(problem.message);}
  },[workspaceId]);

  useEffect(()=>{const controller=new AbortController();load(controller.signal);return()=>controller.abort();},[load,attempt]);

  // Mail status is fetched apart from the connections it hangs off, so the page
  // paints as soon as the connections land rather than waiting on one request per
  // connection. Best-effort: a mailbox whose status cannot be read reads as "not
  // granted", which is the safe way round — it offers the grant rather than
  // implying one that may not exist.
  const liveIds=(connections??[]).filter(row=>row.status!=='DISCONNECTED'&&row.status!=='RECONNECT_REQUIRED').map(row=>row.id).join(',');
  useEffect(()=>{
    if(!liveIds)return;
    const controller=new AbortController();
    for(const id of liveIds.split(',')){
      api<MailStatus>(`workspaces/${workspaceId}/mail-connections/${id}`,{signal:controller.signal})
        .then(state=>setMails(current=>({...current,[id]:state})))
        .catch(()=>setMails(current=>current[id]?current:({...current,[id]:{connectionId:id,provider:'GOOGLE',canSend:false,mailStatus:'UNAVAILABLE'}})));
    }
    return()=>controller.abort();
  },[liveIds,workspaceId]);
  useEffect(()=>{fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(({feedback})=>{if(feedback?.outcome)setNotice(`${feedback.provider&&providerNames[feedback.provider as Provider]?providerNames[feedback.provider as Provider]+': ':''}${outcomes[feedback.outcome]??outcomes.failed}${feedback.outcome==='mail_connected'&&feedback.detail?` Sending as ${feedback.detail}.`:''}`);}).catch(()=>{});},[]);

  async function act(id:string, run:()=>Promise<CalendarConnection[]>) {
    setBusy(id);setNotice(undefined);
    try{ setConnections(await run()); setError(undefined); }
    catch(problem){
      // A failed or timed-out mutation is unconfirmed: reconcile against the server.
      setError(problem instanceof ApiError?problem.message:'That did not complete. Check the connection below.');
      await load();
    } finally { setBusy(undefined); }
  }

  async function connect(provider:Provider) {
    setBusy(provider);setNotice(undefined);
    try{
      const {redirect}=await api<{redirect:string}>(`workspaces/${workspaceId}/calendar-connections/${provider}/connect`,{method:'POST',body:'{}'});
      window.location.assign(redirect);
    }catch(problem){setError(problem instanceof ApiError?problem.message:'Unable to start the connection.');setBusy(undefined);}
  }

  /** The mail grant is its own consent round trip: it asks only for the send scope. */
  async function connectMail(id:string) {
    setBusy(id);setNotice(undefined);
    try{
      const {redirect}=await api<{redirect:string}>(`workspaces/${workspaceId}/mail-connections/${id}/connect`,{method:'POST',body:'{}'});
      window.location.assign(redirect);
    }catch(problem){setError(problem instanceof ApiError?problem.message:'Mailbox permission could not be started.');setBusy(undefined);}
  }

  async function revokeMail(id:string) {
    setBusy(id);setNotice(undefined);
    try{
      await api(`workspaces/${workspaceId}/mail-connections/${id}/revoke`,{method:'POST',body:'{}'});
      setMails(current=>({...current,[id]:{...current[id],canSend:false,senderAddress:undefined,mailStatus:'REVOKED'}}));
      setError(undefined);
    }catch(problem){
      setError(problem instanceof ApiError?problem.message:'Mailbox permission could not be revoked.');
      await load();
    } finally { setBusy(undefined); }
  }

  async function loadCalendars(connection:CalendarConnection) {
    try{
      const result=await api<CalendarOption[]>(`workspaces/${workspaceId}/calendar-connections/${connection.id}/calendars`);
      setCalendars(current=>({...current,[connection.id]:Array.isArray(result)?result:[]}));
    }
    catch{ setCalendars(current=>({...current,[connection.id]:'error'})); }
  }

  if(error&&!connections)return <section className="card"><h2>Calendar connections</h2><p role="alert">{error}</p><button onClick={()=>setAttempt(v=>v+1)}>Try again</button></section>;
  if(!connections||!status)return <section className="card"><h2>Calendar connections</h2><p role="status">Loading calendar connections…</p></section>;

  return <section className="card connections">
    <h2>Calendar connections</h2>
    <p>Connecting a calendar is optional. The rest of Caffriend works without it.</p>
    {notice&&<p role="status" className="notice">{notice}</p>}
    {error&&<p role="alert">{error}</p>}
    {providers.map(provider=>{
      const live=connections.filter(row=>row.provider===provider&&row.status!=='DISCONNECTED');
      const configured=status[provider]?.configured!==false;
      const held=live[0];
      const reconnect=held?.status==='RECONNECT_REQUIRED';
      const mail=held?mails[held.id]:undefined;
      return <article key={provider} className="connection">
        <h3>{providerNames[provider]}</h3>
        {!configured&&<p role="note">{providerNames[provider]} is not configured for Caffriend yet, so it cannot be connected. Everything else in your workspace still works.</p>}
        <div className="switches">
          <Switch label={`${providerNames[provider]} calendar`}
            hint={reconnect?'Reconnect to restore calendar access.':live.length?'Caffriend can read your availability.':'Caffriend cannot see your availability.'}
            checked={live.length>0&&!reconnect} disabled={!configured||busy===provider||(held&&busy===held.id)}
            onChange={next=>{ if(next){connect(provider);return;} if(held&&!reconnect)setConfirming(`disconnect:${held.id}`); }} />
          <Switch label={`Send mail from my ${mailboxNames[provider]} address`}
            hint={mail?.canSend
              ? `Invitations are sent as ${mail.senderAddress}.`
              : reconnect ? 'Reconnect the calendar before changing mailbox permission.'
              : live.length ? 'Invitations cannot be sent until you grant this.'
              : 'Connect the calendar first: the mail grant is held on that connection.'}
            checked={!!mail?.canSend&&!reconnect} disabled={!held||reconnect||busy===held?.id}
            onChange={next=>{ if(!held)return; if(next){connectMail(held.id);return;} setConfirming(`revokemail:${held.id}`); }} />
        </div>
        {held&&confirming===`disconnect:${held.id}`&&
          <div role="group" aria-label="Confirm disconnect" className="confirm">
            <p>Disconnect {providerNames[provider]}? Caffriend stops using this connection, and the mailbox permission held on it goes with it. Meetings already recorded stay in your workspace, and existing invitations are not cancelled. Turning it back on means signing in with {providerNames[provider]} again.</p>
            <button disabled={busy===held.id} onClick={async()=>{setConfirming(undefined);await act(held.id,()=>api<CalendarConnection[]>(`workspaces/${workspaceId}/calendar-connections/${held.id}/disconnect`,{method:'POST',body:'{}',headers:{'X-Idempotency-Key':keyFor(`disconnect:${held.id}`)}}));}}>{busy===held.id?'Disconnecting…':'Yes, disconnect'}</button>
            <button className="secondary" onClick={()=>setConfirming(undefined)}>Keep connection</button>
          </div>}
        {held&&confirming===`revokemail:${held.id}`&&
          <div role="group" aria-label="Confirm revoke" className="confirm">
            <p>Stop sending mail from your address? Caffriend can no longer send invitations as you, and drafts waiting to send will be blocked. Your calendar connection stays. Turning it back on means granting the send permission with {providerNames[provider]} again.</p>
            <button disabled={busy===held.id} onClick={async()=>{setConfirming(undefined);await revokeMail(held.id);}}>{busy===held.id?'Revoking…':'Yes, stop sending'}</button>
            <button className="secondary" onClick={()=>setConfirming(undefined)}>Keep permission</button>
          </div>}
        {live.length===0&&<p>Not connected.</p>}
        {live.map(connection=><div key={connection.id} className="connection-detail">
          <dl>
            <dt>Account</dt><dd>{connection.accountIdentifier || 'Account identifier unavailable'}</dd>
            <dt>Calendar</dt><dd>{connection.status==='RECONNECT_REQUIRED'?'Reconnect required':connection.status==='SELECT_CALENDAR'?'Selection needed':connection.calendarName || connection.calendarId || 'Selection needed'}</dd>
            {/* Granted scopes are a pending backend projection addition. */}
            <dt>Granted access</dt><dd>{connection.scopes?.length?connection.scopes.join(', '):'Granted access unavailable'}</dd>
            <dt>Last error</dt><dd>{connection.errorCode?`${connection.errorCode} — reconnect to resolve this.`:'No error reported. This does not confirm overall provider health.'}</dd>
          </dl>
          {connection.status==='RECONNECT_REQUIRED'&&<button disabled={!configured||busy===provider} onClick={()=>connect(provider)}>{busy===provider?'Opening…':'Reconnect calendar'}</button>}
          {connection.status==='SELECT_CALENDAR'&&(
            calendars[connection.id]===undefined
              ? <button onClick={()=>loadCalendars(connection)}>Choose a calendar</button>
              : calendars[connection.id]==='error'
                ? <p role="alert">Unable to load calendars. <button className="secondary" onClick={()=>loadCalendars(connection)}>Try again</button></p>
                : <form onSubmit={async event=>{ event.preventDefault();
                    const calendarId=String(new FormData(event.currentTarget).get('calendarId')||'');
                    await act(connection.id,()=>api<CalendarConnection[]>(`workspaces/${workspaceId}/calendar-connections/${connection.id}/select`,{method:'POST',body:JSON.stringify({calendarId}),headers:{'X-Idempotency-Key':keyFor(`select:${connection.id}:${calendarId}`)}}));
                  }}>
                    <div className="field">
                      <span className="field-label">Calendar to use</span>
                      <FormSelect name="calendarId" required aria-label="Calendar to use" placeholder="Select a calendar" options={(calendars[connection.id] as CalendarOption[]).filter(item=>item.writable!==false).map(item=>({value:item.id,label:item.name||item.id}))} />
                    </div>
                    <button disabled={busy===connection.id}>{busy===connection.id?'Saving…':'Save calendar'}</button>
                  </form>
          )}
        </div>)}
      </article>;
    })}
  </section>;
}
