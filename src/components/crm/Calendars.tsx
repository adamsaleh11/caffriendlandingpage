'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { providers, providerNames, type CalendarConnection, type CalendarOption, type Provider } from '@/lib/contracts';

type Status = Partial<Record<Provider, {configured:boolean; errorCode?:string|null}>>;
const outcomes: Record<string,string> = {
  select: 'Connected. Choose the calendar Caffriend should use.',
  connected: 'Your calendar connection is up to date.',
  cancelled: 'You cancelled the connection. Nothing was connected.',
  denied: 'The provider did not complete the connection. Nothing was connected.',
  failed: 'The connection could not be completed. Try connecting again.',
  invalid: 'That connection link could not be verified. Start the connection again from Settings.',
  session: 'Your session had expired, so the connection was not completed. Connect again.',
};

export default function Calendars({workspaceId}:{workspaceId:string}) {
  const [status,setStatus]=useState<Status>();
  const [connections,setConnections]=useState<CalendarConnection[]>();
  const [error,setError]=useState<string>();
  const [notice,setNotice]=useState<string>();
  const [busy,setBusy]=useState<string>();
  const [attempt,setAttempt]=useState(0);
  const [calendars,setCalendars]=useState<Record<string,CalendarOption[]|'error'>>({});
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
  useEffect(()=>{fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(({feedback})=>{if(feedback?.outcome)setNotice(`${feedback.provider?providerNames[feedback.provider as Provider]+': ':''}${outcomes[feedback.outcome]??outcomes.failed}`);}).catch(()=>{});},[]);

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
      return <article key={provider} className="connection">
        <h3>{providerNames[provider]}</h3>
        {!configured&&<p role="note">{providerNames[provider]} is not configured for Caffriend yet, so it cannot be connected. Everything else in your workspace still works.</p>}
        {live.length===0&&<p>Not connected.</p>}
        {live.map(connection=><div key={connection.id} className="connection-detail">
          <dl>
            <dt>Account</dt><dd>{connection.accountIdentifier || 'Account identifier unavailable'}</dd>
            <dt>Calendar</dt><dd>{connection.status==='SELECT_CALENDAR'?'Selection needed':connection.calendarName || connection.calendarId || 'Selection needed'}</dd>
            {/* Granted scopes are a pending backend projection addition. */}
            <dt>Granted access</dt><dd>{connection.scopes?.length?connection.scopes.join(', '):'Granted access unavailable'}</dd>
            <dt>Last error</dt><dd>{connection.errorCode?`${connection.errorCode} — reconnect to resolve this.`:'No error reported. This does not confirm overall provider health.'}</dd>
          </dl>
          {connection.status!=='CONNECTED'&&(
            calendars[connection.id]===undefined
              ? <button onClick={()=>loadCalendars(connection)}>Choose a calendar</button>
              : calendars[connection.id]==='error'
                ? <p role="alert">Unable to load calendars. <button className="secondary" onClick={()=>loadCalendars(connection)}>Try again</button></p>
                : <form onSubmit={async event=>{ event.preventDefault();
                    const calendarId=String(new FormData(event.currentTarget).get('calendarId')||'');
                    await act(connection.id,()=>api<CalendarConnection[]>(`workspaces/${workspaceId}/calendar-connections/${connection.id}/select`,{method:'POST',body:JSON.stringify({calendarId}),headers:{'X-Idempotency-Key':keyFor(`select:${connection.id}:${calendarId}`)}}));
                  }}>
                    <label>Calendar to use
                      <select name="calendarId" required defaultValue="">
                        <option value="" disabled>Select a calendar</option>
                        {(calendars[connection.id] as CalendarOption[]).filter(item=>item.writable!==false).map(item=><option key={item.id} value={item.id}>{item.name||item.id}</option>)}
                      </select>
                    </label>
                    <button disabled={busy===connection.id}>{busy===connection.id?'Saving…':'Save calendar'}</button>
                  </form>
          )}
          {confirming===connection.id
            ? <div role="group" aria-label="Confirm disconnect" className="confirm">
                <p>Disconnect {providerNames[provider]}? Caffriend stops using this connection. Meetings already recorded stay in your workspace, and existing invitations are not cancelled.</p>
                <button disabled={busy===connection.id} onClick={async()=>{setConfirming(undefined);await act(connection.id,()=>api<CalendarConnection[]>(`workspaces/${workspaceId}/calendar-connections/${connection.id}/disconnect`,{method:'POST',body:'{}',headers:{'X-Idempotency-Key':keyFor(`disconnect:${connection.id}`)}}));}}>{busy===connection.id?'Disconnecting…':'Yes, disconnect'}</button>
                <button className="secondary" onClick={()=>setConfirming(undefined)}>Keep connection</button>
              </div>
            : <button className="secondary" onClick={()=>setConfirming(connection.id)}>Disconnect</button>}
        </div>)}
        {live.length===0&&<button disabled={!configured||busy===provider} onClick={()=>connect(provider)}>{busy===provider?`Redirecting to ${providerNames[provider]}…`:`Connect ${providerNames[provider]}`}</button>}
      </article>;
    })}
  </section>;
}
