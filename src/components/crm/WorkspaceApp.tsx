'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useWorkspaceList } from './WorkspaceList';
import { homeSection, sectionNames, sections, uuidPattern, type Section, type User, type Workspace } from '@/lib/contracts';
import Shell from './Shell';
import StateCard from './StateCard';
import Calendars from './Calendars';
import People from './People';
import PersonDetail from './PersonDetail';
import Organizations from './Organizations';
import Pipeline from './Pipeline';
import Inbox from './Inbox';
import Agents from './Agents';
import Schedule from './Schedule';
import Audit from './Audit';
import MeetingPage from './MeetingPage';
import CallNotes from './CallNotes';
import InviteHub from './InviteHub';
const descriptions: Record<Section,string> = {
  pipeline:'Where each person you are pursuing currently stands.',
  invites:'Invite people to a coffee chat by email.',
  people:'Everyone in this workspace, whether or not something is in flight.',
  organizations:'The companies behind the people you are tracking.',
  history:'Everything that has happened in this workspace.',
  inbox:'What needs a person: proposals, overdue follow-ups and meetings in trouble.',
  agents:'Optional assistance, with you in control.',
  calendar:'The conversations you have booked.',
  settings:'Manage your workspace connections.',
};
export default function WorkspaceApp({segments,user}:{segments:string[];user:User}) {
  const router=useRouter();
  const {workspaces,problem}=useWorkspaceList();
  const [pending,setPending]=useState(false);
  const [createError,setCreateError]=useState('');
  const selectionKey=`caffriend.workspace.${user.id}`;
  const path=segments.join('/');
  // Choosing where a bare /app should land, and remembering the choice. The list is
  // already here, loaded on the server by the layout, so this lands without a fetch.
  useEffect(()=>{
    if(!workspaces)return;
    const first=path?path.split('/')[0]:'';
    if(!first){
      let last: string | null=null; try{last=sessionStorage.getItem(selectionKey);}catch{}
      const selected=workspaces.find(row=>row.id===last) || (workspaces.length===1?workspaces[0]:null);
      if(!workspaces.length)router.replace('/app/workspaces/new');
      else if(selected)router.replace(`/app/${selected.id}/${homeSection}`);
    }else if(workspaces.some(row=>row.id===first)){
      try{sessionStorage.setItem(selectionKey,first);}catch{}
    }
  },[workspaces,path,router,selectionKey]);
  // Retrying re-runs the layout that loaded the list, rather than a fetch of its own.
  if(problem)return <div className="crm center"><StateCard title={problem.status===403?'Access unavailable':'Unable to load workspaces'} message={problem.message} retry={()=>router.refresh()}/></div>;
  if(segments.join('/')==='workspaces/new')return <main className="crm login"><form className="card" onSubmit={async event=>{
    event.preventDefault();setPending(true);setCreateError('');const name=new FormData(event.currentTarget).get('name');
    try{const created=await api<Workspace>('workspaces',{method:'POST',body:JSON.stringify({name})});router.replace(`/app/${created.id}/${homeSection}`);}
    catch(error){setCreateError(error instanceof Error?error.message:'Please try again.');setPending(false);}
  }}>{/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load leaves CRM styling and providers behind, keeping the landing page untouched */}
    <a href="/" className="brand">caffriend</a><h1>Create your workspace</h1><p>A place to organize your relationships and next steps.</p><label>Workspace name<input name="name" required maxLength={200}/></label>{createError&&<p role="alert">{createError}</p>}<button disabled={pending}>{pending?'Creating…':'Create workspace'}</button><Link href="/app" className="text-link">Back to workspaces</Link></form></main>;
  if(!segments.length)return <main className="crm center"><section className="card chooser"><p className="eyebrow">YOUR CAFFRIEND</p><h1>Choose a workspace</h1><p>Where would you like to work today?</p><ul>{workspaces.map(workspace=><li key={workspace.id}><Link href={`/app/${workspace.id}/${homeSection}`}>{workspace.name}<span aria-hidden="true">↗</span></Link></li>)}</ul><Link href="/app/workspaces/new" className="text-link">Create a workspace</Link></section></main>;
  const workspace=workspaces.find(w=>w.id===segments[0]);
  if(workspace && segments.length===3 && segments[1]==='meetings' && uuidPattern.test(segments[2]))
    return <MeetingPage workspaceId={workspace.id} meetingId={segments[2]}/>;
  // A finished call's notes are a page of their own, under the Meetings section that
  // lists it — never the live call surface, which would start a room for a dead call.
  if(workspace && segments.length===3 && segments[1]==='calls' && uuidPattern.test(segments[2]))
    return <Shell workspaces={workspaces} workspace={workspace} section="calendar" user={user}>
      <CallNotes workspaceId={workspace.id} callId={segments[2]}/>
    </Shell>;
  const section=segments[1] as Section;
  const detailId=segments.length===3 && segments[1]==='people' && uuidPattern.test(segments[2]) ? segments[2] : null;
  if(!workspace || !(segments.length===2 || detailId) || !sections.includes(section))return <div className="crm center"><StateCard title="Page not found" message="This page is unavailable or you no longer have access."/></div>;
  if(detailId)return <Shell workspaces={workspaces} workspace={workspace} section="people" user={user}><PersonDetail workspaceId={workspace.id} personId={detailId}/></Shell>;
  const title=sectionNames[section];
  return <Shell workspaces={workspaces} workspace={workspace} section={section} user={user}>
    <p className="eyebrow">{workspace.name}</p>
    {/* Settings is the one screen whose card supplies no page heading of its own. */}
    {section==='settings' && <><h1>{title}</h1><p className="intro">{descriptions[section]}</p></>}
    {section==='settings' && <Calendars workspaceId={workspace.id}/>}
    {section==='people' && <People workspaceId={workspace.id}/>}
    {section==='organizations' && <Organizations workspaceId={workspace.id}/>}
    {section==='pipeline' && <Pipeline workspaceId={workspace.id}/>}
    {section==='invites' && <InviteHub workspaceId={workspace.id}/>}
    {section==='inbox' && <Inbox workspaceId={workspace.id}/>}
    {section==='agents' && <Agents workspaceId={workspace.id}/>}
    {section==='calendar' && <Schedule workspaceId={workspace.id}/>}
    {section==='history' && <Audit workspaceId={workspace.id}/>}
  </Shell>;
}
