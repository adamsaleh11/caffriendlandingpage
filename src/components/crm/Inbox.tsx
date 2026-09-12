'use client';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { rightsExplanations, statusLabels, type Agent, type Approval, type Conversation, type Engagement, type Meeting, type Person, type SourceArtifact, type SourceClaim, type Task } from '@/lib/contracts';
import Link from 'next/link';
import { useKeys, useList, Section, Empty, More, Rights, Evidence } from './common';
import { useLiveRows } from './record-actions';

const actionNames: Record<string,string> = {
  people: 'Add a person',
  engagements: 'Create an engagement',
  meetings: 'Schedule a meeting',
};

export default function Inbox({workspaceId}:{workspaceId:string}) {
  const approvals = useList<Approval>(`workspaces/${workspaceId}/crm/approvals`);
  const claims = useList<SourceClaim>(`workspaces/${workspaceId}/crm/source-claims`);
  const artifacts = useList<SourceArtifact>(`workspaces/${workspaceId}/crm/source-artifacts`);
  const conversations = useList<Conversation>(`workspaces/${workspaceId}/crm/conversations`);
  const agents = useList<Agent>(`workspaces/${workspaceId}/crm/agents`);
  const people=useLiveRows(useList<Person>(`workspaces/${workspaceId}/crm/people`));
  const tasks=useLiveRows(useList<Task>(`workspaces/${workspaceId}/crm/tasks`));
  const meetings = useList<Meeting>(`workspaces/${workspaceId}/meetings`);
  const engagements=useLiveRows(useList<Engagement>(`workspaces/${workspaceId}/crm/engagements`));

  const [busy, setBusy] = useState<string>();
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState<string>();
  const [rejecting, setRejecting] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const keyFor = useKeys();

  const byId = <T extends {id:string}>(rows: T[] | undefined) => new Map((rows ?? []).map(row => [row.id, row]));
  const agentNames = byId(agents.rows);
  const artifactsById = byId(artifacts.rows);
  const peopleById = byId(people.rows);

  // Pending first, then most recently submitted.
  const ordered = [...(approvals.rows ?? [])].sort((a, b) =>
    (a.status === 'PENDING' ? 0 : 1) - (b.status === 'PENDING' ? 0 : 1) || b.createdAt.localeCompare(a.createdAt));

  function evidenceFor(approval: Approval) {
    const ids = approval.payload?.claimIds ?? [];
    const cited = (claims.rows ?? []).filter(claim => ids.includes(claim.id));
    const artifact = cited.length ? artifactsById.get(cited[0].artifactId) : undefined;
    const conversation = (conversations.rows ?? []).find(row => cited.some(claim => claim.conversationId === row.id));
    return {cited, artifact, conversation};
  }

  /**
   * Prohibited or unestablished rights block approval outright. The backend enforces
   * this too; refusing here means a reviewer is told why before they try, rather
   * than meeting an opaque server error.
   */
  function blocked(approval: Approval, artifact?: SourceArtifact): string | null {
    if (approval.rightsState === 'PROHIBITED' || artifact?.rightsState === 'PROHIBITED')
      return 'This source is marked prohibited. It cannot be approved for outreach, export or republication.';
    if (artifact && artifact.reviewStatus !== 'REVIEWED')
      return 'This source has not had its rights reviewed yet. Review it on the person or source record before approving.';
    if (approval.rightsState === 'UNKNOWN' && !artifact)
      return 'No source is attached, so rights cannot be established. An owner or admin must record a source before this can be approved.';
    return null;
  }

  async function decide(approval: Approval, decision: 'APPROVED'|'REJECTED', extra: {reason?: string; data?: Record<string,unknown>} = {}) {
    setBusy(approval.id); setProblem(''); setNotice('');
    try {
      await api(`workspaces/${workspaceId}/crm/approvals/${approval.id}/review`, {
        method:'POST',
        body: JSON.stringify({decision, ...extra}),
        headers:{'X-Idempotency-Key': keyFor(`review:${approval.id}:${decision}`)},
      });
      setNotice(decision === 'APPROVED' ? 'Approved. The record is now active in your workspace.' : 'Rejected. Nothing was created.');
      setConfirming(undefined); setRejecting(undefined); setEditing(undefined);
      approvals.reload(); people.reload();
    } catch (error) {
      // A competing reviewer decided first. Refetch so the real outcome is shown.
      const conflict = error instanceof ApiError && error.status === 409;
      setProblem(conflict
        ? 'Someone else already reviewed this proposal. Its current decision is shown below.'
        : error instanceof ApiError ? error.message : 'That decision did not save.');
      if (conflict) approvals.reload();
    } finally { setBusy(undefined); }
  }

  /**
   * Work that needs a person, drawn from records the backend already holds: a
   * follow-up whose due date has passed, and a meeting the calendar could not
   * complete. There is no reply feed to read — the backend stores outreach status
   * per invitation and external conversations by reference only — so a reply
   * reaches this screen when someone records it on the engagement, not before.
   */
  const now = Date.now();
  const personFor = (task: Task) => task.personId
    ? peopleById.get(task.personId)
    : task.engagementId
      ? peopleById.get((engagements.rows ?? []).find(row => row.id === task.engagementId)?.personId ?? '')
      : undefined;
  const overdue = (tasks.rows ?? [])
    .filter(task => task.status !== 'DONE' && !task.archivedAt && task.dueAt && Date.parse(task.dueAt) < now)
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
  const troubled = (meetings.rows ?? [])
    .filter(meeting => ['FAILED', 'CANCEL_FAILED', 'PENDING', 'CANCEL_PENDING'].includes(meeting.status));
  const attention = overdue.length + troubled.length;

  return <Section title="Inbox" intro="What needs you: overdue follow-ups, meetings the calendar could not finish, and proposals waiting for a decision." state={approvals}>
    {notice && <p role="status" className="notice">{notice}</p>}
    {problem && <p role="alert">{problem}</p>}

    <h2>Needs attention</h2>
    {(!tasks.rows || !meetings.rows) && <p role="status">Loading follow-ups and meetings…</p>}
    {tasks.error && <p role="alert">Follow-ups could not be loaded. <button className="secondary" onClick={tasks.reload}>Try again</button></p>}
    {meetings.error && <p role="alert">Meetings could not be loaded. <button className="secondary" onClick={meetings.reload}>Try again</button></p>}
    {tasks.rows && meetings.rows && attention === 0 &&
      <Empty>Nothing is overdue and no meeting is stuck. Replies are recorded on a person&apos;s engagement, so they do not appear here on their own.</Empty>}

    {overdue.length > 0 && <ul className="attention">
      {overdue.map(task => { const owner = personFor(task); return <li key={task.id}>
        <strong>Overdue follow-up</strong> — {task.title}
        <span className="small"> due {new Date(task.dueAt!).toLocaleDateString()}</span>
        {owner && <> · <Link href={`/app/${workspaceId}/people/${owner.id}`}>{owner.displayName}</Link></>}
      </li>; })}
    </ul>}
    {troubled.length > 0 && <ul className="attention">
      {troubled.map(meeting => <li key={meeting.id}>
        <strong>Meeting needs attention</strong> — <Link href={`/app/${workspaceId}/meetings/${meeting.id}`}>{meeting.purpose}</Link>
        <span className="small"> {statusLabels[meeting.status] ?? meeting.status} · {new Date(meeting.startsAt).toLocaleString()}</span>
      </li>)}
    </ul>}

    <h2>Proposals</h2>
    {ordered.length === 0 && <Empty>Nothing is waiting for review. Proposals appear here when a connected agent suggests a change.</Empty>}

    <ol className="proposals">
      {ordered.map(approval => {
        const {cited, artifact, conversation} = evidenceFor(approval);
        const data = approval.payload?.data ?? {};
        const stop = blocked(approval, artifact);
        const pending = approval.status === 'PENDING';
        const person = typeof data.personId === 'string' ? peopleById.get(data.personId) : undefined;
        return <li key={approval.id} className={`proposal ${pending ? '' : 'decided'}`}>
          <h3>{actionNames[approval.action] ?? approval.action}</h3>
          <dl>
            <dt>Requested by</dt><dd>{approval.requesterAgentId
              ? `${agentNames.get(approval.requesterAgentId)?.name ?? 'An agent'} (agent)`
              : 'A member of this workspace'}</dd>
            <dt>Submitted</dt><dd>{new Date(approval.createdAt).toLocaleString()}</dd>
            <dt>Status</dt><dd>{approval.status === 'PENDING' ? 'Waiting for your decision' : approval.status === 'APPROVED' ? 'Approved' : 'Rejected'}{approval.reason ? ` — ${approval.reason}` : ''}</dd>
            <dt>Rights</dt><dd><Rights state={approval.rightsState}/> {rightsExplanations[approval.rightsState]}</dd>
            {person && <><dt>Person</dt><dd>{person.displayName}</dd></>}
            {typeof data.displayName === 'string' && <><dt>Proposed name</dt><dd>{data.displayName}</dd></>}
            {typeof data.objective === 'string' && <><dt>Objective</dt><dd>{data.objective}</dd></>}
            {typeof data.purpose === 'string' && <><dt>Meeting purpose</dt><dd>{data.purpose}</dd></>}
            {typeof data.startsAt === 'string' && <><dt>Proposed time</dt><dd>{new Date(data.startsAt).toLocaleString()}{typeof data.timezone === 'string' ? ` (${data.timezone})` : ''}</dd></>}
            {typeof data.pipelineId === 'string' && <><dt>Proposed pipeline and stage</dt><dd>The pipeline and stage named in this proposal.</dd></>}
          </dl>

          {/* Evidence and licensing are shown before the decision controls, never after. */}
          <Evidence artifact={artifact} claims={cited} conversation={conversation} />

          {!pending && <p role="status">This proposal was already {approval.status.toLowerCase()}. It cannot be decided again.</p>}

          {pending && approval.action === 'meetings' && <p role="note">
            A meeting proposal is confirmed on the Calendar screen, not here. An agent can never create a calendar invitation directly — you choose the account, attendees and time yourself.
          </p>}

          {pending && approval.action !== 'meetings' && (stop
            ? <p role="alert">{stop}</p>
            : <div className="decide">
                {editing === approval.id
                  ? <form onSubmit={event => { event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      const edited: Record<string,unknown> = {...data};
                      for (const [field, value] of form.entries()) if (typeof value === 'string' && value.trim()) edited[field] = value.trim();
                      decide(approval, 'APPROVED', {data: edited});
                    }}>
                      <p>Edit before approving. Only the fields you change are altered.</p>
                      {typeof data.displayName === 'string' && <label>Name<input name="displayName" defaultValue={data.displayName} maxLength={200} /></label>}
                      {typeof data.title === 'string' && <label>Role<input name="title" defaultValue={data.title} maxLength={200} /></label>}
                      {typeof data.objective === 'string' && <label>Objective<input name="objective" defaultValue={data.objective} maxLength={2000} /></label>}
                      <button disabled={busy === approval.id}>{busy === approval.id ? 'Saving…' : 'Approve with these edits'}</button>
                      <button type="button" className="secondary" onClick={() => setEditing(undefined)}>Cancel</button>
                    </form>
                  : confirming === approval.id
                    ? <div role="group" aria-label="Confirm approval" className="confirm">
                        <p>Approve this proposal? It creates a real record in <strong>{workspaceId ? 'this workspace' : 'your workspace'}</strong> and is recorded in the audit history.</p>
                        <button disabled={busy === approval.id} onClick={() => decide(approval, 'APPROVED')}>{busy === approval.id ? 'Approving…' : 'Yes, approve'}</button>
                        <button className="secondary" onClick={() => setConfirming(undefined)}>Cancel</button>
                      </div>
                    : rejecting === approval.id
                      ? <form onSubmit={event => { event.preventDefault();
                          const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
                          decide(approval, 'REJECTED', {reason});
                        }}>
                          <label>Why are you rejecting this? <span className="small">Required. The requester and the audit history both record it.</span>
                            <textarea name="reason" required maxLength={2000} rows={3} />
                          </label>
                          <button disabled={busy === approval.id}>{busy === approval.id ? 'Rejecting…' : 'Reject proposal'}</button>
                          <button type="button" className="secondary" onClick={() => setRejecting(undefined)}>Cancel</button>
                        </form>
                      : <>
                          <button onClick={() => setConfirming(approval.id)}>Approve</button>
                          <button className="secondary" onClick={() => setEditing(approval.id)}>Edit, then approve</button>
                          <button className="secondary" onClick={() => setRejecting(approval.id)}>Reject</button>
                        </>}
              </div>)}
        </li>;
      })}
    </ol>
    <More state={approvals} />
  </Section>;
}
