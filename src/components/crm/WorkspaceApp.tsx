'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { sections, uuidPattern, type Section, type User, type Workspace } from '@/lib/contracts';
import Shell from './Shell';
import StateCard from './StateCard';
import Calendars from './Calendars';
import MeetingPage from './MeetingPage';
const descriptions: Record<Section,string> = {
  people:'Build meaningful relationships, one person at a time.',
  pipeline:'Keep your relationships moving toward their next step.',
  inbox:'A place to review incoming work and follow-ups.',
  agents:'Optional assistance, with you in control.',
  calendar:'Make room for the conversations that matter.',
  settings:'Manage your workspace connections.',
};
export default function WorkspaceApp({segments,user}:{segments:string[];user:User}) {
  const router=useRouter();
  const [workspaces,setWorkspaces]=useState<Workspace[]>();
  const [error,setError]=useState<ApiError>();
  const [attempt,setAttempt]=useState(0);
  const [pending,setPending]=useState(false);
  const [createError,setCreateError]=useState('');
  const selectionKey=`caffriend.workspace.${user.id}`;
  useEffect(()=>{
    const controller=new AbortController();
    api<Workspace[]>('workspaces',{signal:controller.signal}).then(rows=>{
      if(controller.signal.aborted)return;
      setWorkspaces(rows);
      if(!segments.length){
        let last: string | null=null; try{last=sessionStorage.getItem(selectionKey);}catch{}
        const selected=rows.find(row=>row.id===last) || (rows.length===1?rows[0]:null);
        if(!rows.length)router.replace('/app/workspaces/new');
        else if(selected)router.replace(`/app/${selected.id}/people`);
      }else if(rows.some(row=>row.id===segments[0])){
        try{sessionStorage.setItem(selectionKey,segments[0]);}catch{}
      }
    }).catch(error=>{if(!controller.signal.aborted)setError(error instanceof ApiError?error:new ApiError(503,'The workspace service is unavailable.'));});
    return ()=>controller.abort();
  },[router,segments,selectionKey,attempt]);
  const retry=()=>{setError(undefined);setWorkspaces(undefined);setAttempt(value=>value+1);};
  if(error)return <div className="crm center"><StateCard title={error.status===403?'Access unavailable':'Unable to load workspaces'} message={error.message} retry={retry}/></div>;
  if(!workspaces)return <div className="crm center"><p role="status">Loading workspace…</p></div>;
  if(segments.join('/')==='workspaces/new')return <main className="crm login"><form className="card" onSubmit={async event=>{
    event.preventDefault();setPending(true);setCreateError('');const name=new FormData(event.currentTarget).get('name');
    try{const created=await api<Workspace>('workspaces',{method:'POST',body:JSON.stringify({name})});router.replace(`/app/${created.id}/people`);}
    catch(error){setCreateError(error instanceof Error?error.message:'Please try again.');setPending(false);}
  }}>{/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load leaves CRM styling and providers behind, keeping the landing page untouched */}
    <a href="/" className="brand">caffriend</a><h1>Create your workspace</h1><p>A place to organize your relationships and next steps.</p><label>Workspace name<input name="name" required maxLength={200}/></label>{createError&&<p role="alert">{createError}</p>}<button disabled={pending}>{pending?'Creating…':'Create workspace'}</button><Link href="/app" className="text-link">Back to workspaces</Link></form></main>;
  if(!segments.length)return <main className="crm center"><section className="card chooser"><p className="eyebrow">YOUR CAFFRIEND</p><h1>Choose a workspace</h1><p>Where would you like to work today?</p><ul>{workspaces.map(workspace=><li key={workspace.id}><Link href={`/app/${workspace.id}/people`}>{workspace.name}<span aria-hidden="true">↗</span></Link></li>)}</ul><Link href="/app/workspaces/new" className="text-link">Create a workspace</Link></section></main>;
  const workspace=workspaces.find(w=>w.id===segments[0]);
  if(workspace && segments.length===3 && segments[1]==='meetings' && uuidPattern.test(segments[2]))
    return <MeetingPage workspaceId={workspace.id} meetingId={segments[2]}/>;
  const section=segments[1] as Section;
  if(!workspace || segments.length!==2 || !sections.includes(section))return <div className="crm center"><StateCard title="Page not found" message="This page is unavailable or you no longer have access."/></div>;
  const title=section[0].toUpperCase()+section.slice(1);
  return <Shell workspaces={workspaces} workspace={workspace} section={section} user={user}>
    <p className="eyebrow">{workspace.name}</p><h1>{title}</h1><p className="intro">{descriptions[section]}</p>
    {section==='settings'
      ? <Calendars workspaceId={workspace.id}/>
      : <section className="card empty"><div className="empty-symbol" aria-hidden="true">{section==='people'?'◎':'◇'}</div><h2>{title} is taking shape</h2><p>This area is ready for the next part of Caffriend. There are no records to show yet.</p><Link className="text-link" href={`/app/${workspace.id}/settings`}>Workspace settings →</Link></section>}
  </Shell>;
}
