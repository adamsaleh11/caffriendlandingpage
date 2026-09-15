'use client';
import {useState} from 'react';
import {useList,useRows,Section,Empty} from './common';
import { useLiveRows } from './record-actions';
import type {Engagement,Person,Pipeline,Stage} from '@/lib/contracts';
import BulkOutreachComposer, {type InviteTarget} from './BulkOutreachComposer';
import SentInvites from './SentInvites';

export default function InviteHub({workspaceId}:{workspaceId:string}){
 const people=useLiveRows(useList<Person>(`workspaces/${workspaceId}/crm/people`));const engagements=useLiveRows(useList<Engagement>(`workspaces/${workspaceId}/crm/engagements`));const pipelines=useRows<Pipeline>(`workspaces/${workspaceId}/pipelines`);
 const pipeline=pipelines.rows?.find(row=>!row.archived);const stages=useRows<Stage>(pipeline?`workspaces/${workspaceId}/pipelines/${pipeline.id}/stages`:null);
 const [selected,setSelected]=useState<string[]>([]);const [emails,setEmails]=useState('');const [composing,setComposing]=useState(false);
 const entered=[...new Set(emails.split(/[\n,;]/).map(email=>email.trim().toLowerCase()).filter(Boolean))];
 const invalid=entered.filter(email=>!/^\S+@\S+\.\S+$/.test(email));
 const selectedPeople=(people.rows??[]).filter(person=>selected.includes(person.id)&&person.email);
 const chosenEmails=new Set(selectedPeople.map(person=>person.email!.toLowerCase()));
 const targets:InviteTarget[]=[...selectedPeople.map(person=>({email:person.email!,person,engagementId:(engagements.rows??[]).find(row=>row.personId===person.id&&row.status!=='CLOSED')?.id})),...entered.filter(email=>!chosenEmails.has(email)&&!invalid.includes(email)).map(email=>({email}))];
 const loading=!people.rows||!engagements.rows||!pipelines.rows||(pipeline&&!stages.rows);
 return <Section title="Coffee chat invites" intro="Invite people from your workspace or add email addresses directly. Each recipient gets their own private response link." state={people}>
  {loading&&<p role="status">Loading people and pipeline tracking…</p>}
  {!loading&&<div className="invite-hub-grid"><section><h2>People</h2>{people.rows?.length===0?<Empty>No people yet. Add email addresses instead.</Empty>:<div className="recipient-list">{(people.rows??[]).map(person=><label className="recipient-card" key={person.id}><input type="checkbox" disabled={!person.email} checked={selected.includes(person.id)} onChange={event=>setSelected(rows=>event.target.checked?[...rows,person.id]:rows.filter(id=>id!==person.id))}/><span><strong>{person.displayName}</strong><small>{person.email||'Add an email to invite this person'}</small></span></label>)}</div>}</section>
   <section className="invite-email-card"><h2>Anyone by email</h2><label>Email addresses<textarea aria-label="Email addresses" rows={7} value={emails} onChange={event=>setEmails(event.target.value)} placeholder={'sam@example.com\njordan@example.com'}/><span className="small">Separate addresses with commas or new lines.</span></label>{invalid.length>0&&<p role="alert">Check {invalid.join(', ')} — {invalid.length===1?'it is not a valid email address':'they are not valid email addresses'}.</p>}<p><strong>{targets.length}</strong> recipient{targets.length===1?'':'s'} selected</p><button disabled={!targets.length||invalid.length>0||!pipeline||!stages.rows?.length} onClick={()=>setComposing(true)}>Create invitation</button>{!pipeline&&<p role="alert">A pipeline is required so bookings can be tracked.</p>}</section></div>}
  {!loading&&<SentInvites workspaceId={workspaceId}/>}
  {composing&&pipeline&&stages.rows&&<BulkOutreachComposer workspaceId={workspaceId} targets={targets} pipeline={pipeline} stages={stages.rows} onClose={()=>setComposing(false)} onSent={()=>{people.reload();engagements.reload();}}/>}
 </Section>;
}
