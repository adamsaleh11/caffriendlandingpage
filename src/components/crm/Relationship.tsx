'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { engagementStatuses, joinable, statusLabels, type Engagement, type Meeting, type Note, type Stage, type Task } from '@/lib/contracts';
import { guidanceFor } from '@/lib/lifecycle';
import { Empty } from './common';
import type { WorkspaceData } from './workspace-data';

/**
 * What the user is invited to do at each point of the lifecycle.
 *
 * Keyed by the stage's own name, so a workspace that renamed or replaced its steps
 * simply gets the plain controls instead of a wrong prompt. `advanceTo` names the
 * stage to move to; it is resolved against the pipeline's real stage rows and, if
 * that name is not present, falls back to the next stage by position. Nothing
 * moves without the user pressing the button.
 */
type Step = {
  /** The button and heading for this stage's main action. */
  action: string;
  /** What the recorded text is for. Written to a real note on the engagement. */
  noteLabel: string;
  notePlaceholder: string;
  advanceTo?: string;
  /** Offer a follow-up task alongside the note. */
  task?: { label: string; placeholder: string };
  /** Point at the Meetings screen rather than pretending to schedule here. */
  scheduling?: boolean;
};

const steps: Record<string, Step> = {
  prospect: {
    action: 'Qualify this person',
    noteLabel: 'Why are they worth pursuing?',
    notePlaceholder: 'Founder building AI infrastructure in Toronto. Hiring for the platform team.',
    advanceTo: 'Qualified',
  },
  qualified: {
    action: 'Record your outreach',
    noteLabel: 'What did you send, and how?',
    notePlaceholder: 'Sent a LinkedIn message on 11 Sep asking for 20 minutes.',
    advanceTo: 'Contacted',
  },
  contacted: {
    action: 'Record their reply',
    noteLabel: 'What did they say?',
    notePlaceholder: 'Replied — happy to chat, suggested next week.',
    advanceTo: 'Engaged',
  },
  engaged: {
    action: 'Start scheduling',
    noteLabel: 'What are you arranging?',
    notePlaceholder: 'Looking for 30 minutes Tuesday or Wednesday afternoon.',
    advanceTo: 'Scheduling',
  },
  scheduling: {
    action: 'Mark the meeting as booked',
    noteLabel: 'What was agreed?',
    notePlaceholder: 'Agreed Tuesday 17 Sep, 2pm Toronto.',
    advanceTo: 'Meeting booked',
    scheduling: true,
  },
  'meeting booked': {
    action: 'Record how it went',
    noteLabel: 'What came of the conversation?',
    notePlaceholder: 'Good conversation. They will introduce me to the hiring manager.',
    advanceTo: 'Completed',
  },
  completed: {
    action: 'Set up the follow-up',
    noteLabel: 'What did you commit to?',
    notePlaceholder: 'Sending my portfolio and a short note about the platform role.',
    advanceTo: 'Follow-up',
    task: { label: 'What must happen next?', placeholder: 'Send portfolio and follow up on the introduction' },
  },
  'follow-up': {
    action: 'Close the follow-up',
    noteLabel: 'What happened?',
    notePlaceholder: 'Sent the portfolio; they replied and made the introduction.',
    advanceTo: 'Relationship',
  },
  relationship: {
    action: 'Add to the record',
    noteLabel: 'What is worth remembering?',
    notePlaceholder: 'Catch up again after their product launch in November.',
  },
};

/**
 * Outcome vocabulary offered when a conversation is recorded. These are written
 * into the note the user is already writing — the backend has no outcome column —
 * so the wording stays theirs and nothing is stored that the server did not
 * receive. Deliberately not sales-only.
 */
const outcomes = [
  'Strong relationship', 'Follow up later', 'Another meeting needed', 'Opportunity',
  'Candidate advancing', 'Partnership discussion', 'Introduction promised', 'Not relevant', 'Closed',
];

export default function Relationship({
  workspaceId, engagement, stages, data, onChanged,
}: {
  workspaceId: string;
  engagement: Engagement;
  /** The stage rows of this engagement's own pipeline. */
  stages: Stage[];
  data: WorkspaceData;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [recording, setRecording] = useState(false);
  const [outcome, setOutcome] = useState('');

  const open = stages.filter(stage => !stage.archived);
  const stage = stages.find(row => row.id === engagement.stageId);
  const index = stage ? open.findIndex(row => row.id === stage.id) : -1;
  const help = stage ? guidanceFor(stage.name) : undefined;
  const step = stage ? steps[stage.name.trim().toLowerCase()] : undefined;

  /** The stage this step wants, if the pipeline has it; otherwise simply the next one. */
  const target = (step?.advanceTo && open.find(row => row.name.trim().toLowerCase() === step.advanceTo!.toLowerCase()))
    || (index >= 0 && index < open.length - 1 ? open[index + 1] : undefined);

  const meetings = (data.meetings.rows ?? []).filter(row => row.engagementId === engagement.id);
  const upcoming = meetings.filter(row => Date.parse(row.endsAt) >= Date.now() && row.status !== 'CANCELLED');
  const past = meetings.filter(row => !upcoming.includes(row));
  const tasks = (data.tasks.rows ?? []).filter(row => row.engagementId === engagement.id);
  const notes = (data.notes.rows ?? []).filter(row => row.engagementId === engagement.id);

  const key = () => crypto.randomUUID();

  async function write(path: string, method: string, body: unknown) {
    return api(path, { method, body: JSON.stringify(body), headers: {'X-Idempotency-Key': key()} });
  }

  /**
   * One recorded moment: the substance as a note, the position change, the next
   * action, and any follow-up task. Each is a real backend write. If a write
   * fails the failure is shown — nothing is reported as saved that was not.
   */
  async function record(form: FormData) {
    const body = String(form.get('body') ?? '').trim();
    const nextAction = String(form.get('nextAction') ?? '').trim();
    const taskTitle = String(form.get('taskTitle') ?? '').trim();
    const taskDue = String(form.get('taskDue') ?? '');
    const advance = form.get('advance') === 'on';

    setPending(true); setProblem(''); setNotice('');
    try {
      if (body) await write(`workspaces/${workspaceId}/crm/notes`, 'POST', {
        body: outcome ? `${outcome}: ${body}` : body,
        personId: engagement.personId ?? undefined,
        engagementId: engagement.id,
      });
      if (taskTitle) await write(`workspaces/${workspaceId}/crm/tasks`, 'POST', {
        title: taskTitle, status: 'OPEN', engagementId: engagement.id,
        personId: engagement.personId ?? undefined,
        ...(taskDue ? {dueAt: new Date(taskDue).toISOString()} : {}),
      });
      const patch: Record<string, unknown> = {};
      if (advance && target) patch.stageId = target.id;
      if (nextAction) patch.nextAction = nextAction;
      if (Object.keys(patch).length) await write(`workspaces/${workspaceId}/crm/engagements/${engagement.id}`, 'PATCH', patch);

      setNotice(advance && target ? `Recorded, and moved to ${target.name}.` : 'Recorded.');
      setRecording(false); setOutcome('');
      onChanged();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That was not saved. Nothing has been changed.');
    } finally { setPending(false); }
  }

  async function moveTo(stageId: string) {
    setPending(true); setProblem(''); setNotice('');
    try {
      await write(`workspaces/${workspaceId}/crm/engagements/${engagement.id}`, 'PATCH', {stageId});
      setNotice(`Moved to ${open.find(row => row.id === stageId)?.name ?? 'the new stage'}.`);
      onChanged();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That move did not save.');
    } finally { setPending(false); }
  }

  async function setStatus(status: string) {
    setPending(true); setProblem(''); setNotice('');
    try { await write(`workspaces/${workspaceId}/crm/engagements/${engagement.id}`, 'PATCH', {status}); setNotice(`Status set to ${status}.`); onChanged(); }
    catch (error) { setProblem(error instanceof ApiError ? error.message : 'That did not save.'); }
    finally { setPending(false); }
  }

  async function completeTask(task: Task) {
    setPending(true); setProblem('');
    try { await write(`workspaces/${workspaceId}/crm/tasks/${task.id}`, 'PATCH', {status: 'DONE'}); setNotice(`“${task.title}” marked done.`); onChanged(); }
    catch (error) { setProblem(error instanceof ApiError ? error.message : 'That did not save.'); }
    finally { setPending(false); }
  }

  return <article className="engagement-detail">
    <header>
      <h3>{engagement.objective}</h3>
      <p className="small">
        <strong>{stage?.name ?? 'Stage unavailable'}</strong>
        {stage?.archived && ' (retired step)'}
        {' · '}{engagement.status}
        {' · '}{engagement.ownerId ? 'Owner recorded' : 'No owner'}
        {' · started '}{new Date(engagement.createdAt).toLocaleDateString()}
      </p>
      {help && <p className="intro">{help.meaning} <span className="quiet">{help.prompt}</span></p>}
    </header>

    {notice && <p role="status" className="notice">{notice}</p>}
    {problem && <p role="alert">{problem}</p>}

    <p className="next">{engagement.nextAction ? <>Next: {engagement.nextAction}</> : <span className="quiet">No next action recorded.</span>}</p>

    {/* Where it stands, and where it goes next, in one control. */}
    <div className="move" role="group" aria-label="Move this engagement">
      <label htmlFor={`detail-stage-${engagement.id}`}>Stage</label>
      <select id={`detail-stage-${engagement.id}`} value={engagement.stageId} disabled={pending}
        onChange={event => moveTo(event.target.value)}>
        {open.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        {stage?.archived && <option value={stage.id}>{stage.name} (retired)</option>}
      </select>
      <label htmlFor={`detail-status-${engagement.id}`}>Status</label>
      <select id={`detail-status-${engagement.id}`} value={engagement.status} disabled={pending}
        onChange={event => setStatus(event.target.value)}>
        {[...new Set([engagement.status, ...engagementStatuses])].map(value =>
          <option key={value} value={value}>{value.replace('_', ' ').toLowerCase()}</option>)}
      </select>
    </div>

    {/* The one thing this stage is asking for. */}
    {recording
      ? <form onSubmit={event => { event.preventDefault(); record(new FormData(event.currentTarget)); }}>
          <h4>{step?.action ?? 'Record what happened'}</h4>
          <label>{step?.noteLabel ?? 'What happened?'}
            <textarea name="body" rows={3} maxLength={20000} required autoFocus placeholder={step?.notePlaceholder} />
          </label>
          {/* Offered wherever a conversation is being closed out. */}
          {(step?.advanceTo === 'Completed' || step?.advanceTo === 'Follow-up') && <label>Outcome
            <select value={outcome} onChange={event => setOutcome(event.target.value)}>
              <option value="">No outcome recorded</option>
              {outcomes.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <span className="small">The backend has no outcome column, so your choice is saved at the front of the note.</span>
          </label>}
          {step?.task && <>
            <label>{step.task.label}<input name="taskTitle" maxLength={500} placeholder={step.task.placeholder} /></label>
            <label>Due<input name="taskDue" type="date" /></label>
          </>}
          <label>Next action<input name="nextAction" maxLength={2000} defaultValue={engagement.nextAction ?? ''} /></label>
          {target && <label className="choice">
            <input type="checkbox" name="advance" defaultChecked />
            Move to <strong>{target.name}</strong>
          </label>}
          <button disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
          <button type="button" className="secondary" onClick={() => { setRecording(false); setOutcome(''); }}>Cancel</button>
        </form>
      : <button onClick={() => { setRecording(true); setNotice(''); }}>{step?.action ?? 'Record what happened'}</button>}

    {step?.scheduling && <p role="note">
      Meetings are created on the <Link className="text-link" href={`/app/${workspaceId}/calendar`}>Meetings</Link> screen, where you
      choose the calendar account, time and conference. Link the meeting to this engagement there and it will appear below.
    </p>}

    <h4>Meetings</h4>
    {!data.meetings.rows && <p role="status">Loading meetings…</p>}
    {data.meetings.rows && meetings.length === 0 && <Empty>No meeting is linked to this engagement yet.</Empty>}
    {upcoming.map(meeting => <MeetingRow key={meeting.id} workspaceId={workspaceId} meeting={meeting} upcoming />)}
    {past.map(meeting => <MeetingRow key={meeting.id} workspaceId={workspaceId} meeting={meeting} />)}

    <h4>Follow-ups</h4>
    {!data.tasks.rows && <p role="status">Loading follow-ups…</p>}
    {data.tasks.rows && tasks.length === 0 && <Empty>Nothing is owed on this engagement.</Empty>}
    <ul className="tasks">{tasks.map(task => <li key={task.id}>
      {task.title}
      <span className="small"> — {task.status}{task.dueAt ? `, due ${new Date(task.dueAt).toLocaleDateString()}` : ', no date'}</span>
      {task.status !== 'DONE' && <button className="secondary" disabled={pending} onClick={() => completeTask(task)}>
        Mark done<span className="sr-only"> — {task.title}</span>
      </button>}
    </li>)}</ul>

    <h4>What was said</h4>
    {!data.notes.rows && <p role="status">Loading notes…</p>}
    {data.notes.rows && notes.length === 0 && <Empty>Nothing has been recorded on this engagement yet.</Empty>}
    <ul className="notes">{[...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((note: Note) => <li key={note.id}>
      <p>{note.body}</p><p className="small">{new Date(note.createdAt).toLocaleString()}</p>
    </li>)}</ul>
  </article>;
}

function MeetingRow({workspaceId, meeting, upcoming}:{workspaceId:string; meeting:Meeting; upcoming?:boolean}) {
  return <p className={`meeting-row ${upcoming ? 'upcoming' : ''}`}>
    <Link href={`/app/${workspaceId}/meetings/${meeting.id}`}>{meeting.purpose}</Link>
    <span className="small"> — {new Date(meeting.startsAt).toLocaleString()} ({meeting.timezone}) · {statusLabels[meeting.status] ?? meeting.status}</span>
    {/* Joinable only while the server says the meeting is scheduled. */}
    {upcoming && joinable(meeting.status) && meeting.joinUrl &&
      <a className="join" href={meeting.joinUrl} target="_blank" rel="noreferrer noopener">Join<span className="sr-only"> {meeting.purpose}</span></a>}
  </p>;
}
