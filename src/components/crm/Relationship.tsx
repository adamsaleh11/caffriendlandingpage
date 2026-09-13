'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { engagementStatuses, joinable, statusLabels, type Engagement, type Meeting, type Note, type Stage, type Task } from '@/lib/contracts';
import { guidanceFor } from '@/lib/lifecycle';
import { Empty } from './common';
import type { WorkspaceData } from './workspace-data';
import OutreachComposer from './OutreachComposer';
import Modal from './Modal';
import { ArchiveButton, PermanentDeleteButton, editRecord, problemText } from './record-actions';
import { EngagementEditor, NoteEditor, TaskEditor } from './RecordEditors';
import { talkingPoints } from './person-profile';
import {FormSelect} from '@/components/ui/form-select';
import {DatePicker} from '@/components/ui/date-picker';

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
    action: 'Record your outreach',
    noteLabel: 'What did you send, and how?',
    notePlaceholder: 'Sent a LinkedIn message on 11 Sep asking for 20 minutes.',
    advanceTo: 'Contacted',
  },
  contacted: {
    action: 'Record contact activity',
    noteLabel: 'What happened?',
    notePlaceholder: 'Replied — happy to chat, so I sent a coffee chat invitation.',
  },
  'meeting booked': {
    action: 'Record how it went',
    noteLabel: 'What came of the conversation?',
    notePlaceholder: 'Good conversation. They will introduce me to the hiring manager.',
    advanceTo: 'Follow-up',
    task: { label: 'What must happen next?', placeholder: 'Send portfolio and follow up on the introduction' },
  },
  'follow-up': {
    action: 'Close the follow-up',
    noteLabel: 'What happened?',
    notePlaceholder: 'Sent the portfolio; they replied and made the introduction.',
    advanceTo: 'Closed',
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
  const [taskDue, setTaskDue] = useState('');
  const [inviting, setInviting] = useState(false);
  const [editingEngagement, setEditingEngagement] = useState(false);
  const [editingNote, setEditingNote] = useState<Note>();
  const [editingTask, setEditingTask] = useState<Task>();

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
  const person = (data.people.rows ?? []).find(row => row.id === engagement.personId);

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

  /** One edit of a record that already exists, reported as saved only when it was. */
  async function change(resource: 'notes'|'tasks'|'engagements', id: string, body: Record<string,unknown>, message: string) {
    setPending(true); setProblem(''); setNotice('');
    try { await editRecord(workspaceId, resource, id, body); setNotice(message); onChanged(); return true; }
    catch (error) { setProblem(problemText(error, 'That change did not save.')); return false; }
    finally { setPending(false); }
  }

  async function completeTask(task: Task) {
    setPending(true); setProblem('');
    try { await write(`workspaces/${workspaceId}/crm/tasks/${task.id}`, 'PATCH', {status: 'DONE'}); setNotice(`“${task.title}” marked done.`); onChanged(); }
    catch (error) { setProblem(error instanceof ApiError ? error.message : 'That did not save.'); }
    finally { setPending(false); }
  }

  /** Where this sits in its own pipeline, shown the same way a profile's progress is. */
  const statusWord = engagement.status.replace(/_/g, ' ').toLowerCase();
  /** People type next actions as a dashed list; show them as one, not as raw text. */
  const nextActions = talkingPoints(engagement.nextAction);

  return <article className="engagement-detail">
    <header className="engagement-head">
      <div className="engagement-head-text">
        <h3>{engagement.objective}</h3>
        {/* The facts about this effort, each as its own chip rather than one run-on line. */}
        <p className="chips static">
          {stage
            ? <span className="chip solid">{stage.name}{stage.archived ? ' (retired step)' : ''}</span>
            : <span className="chip warn" title="This engagement points at a pipeline step this workspace no longer has. Choose a stage below.">Stage unavailable</span>}
          <span className="chip">{statusWord}</span>
          <span className="chip">{engagement.ownerId ? 'Owner recorded' : 'No owner'}</span>
          <span className="chip">Started {new Date(engagement.createdAt).toLocaleDateString()}</span>
        </p>
      </div>
      {!recording && <div className="engagement-head-actions">
        {/* What this engagement is asking for comes first; the ways to end it sit
          apart at the end, so archiving is never the nearest button. */}
        <button onClick={() => { setRecording(true); setNotice(''); }}>{step?.action ?? 'Record what happened'}</button>
        {engagement.status !== 'CLOSED' && <button className="secondary" onClick={() => { setInviting(true); setNotice(''); }}>Send coffee chat invite</button>}
        <button className="secondary" onClick={() => { setEditingEngagement(true); setNotice(''); setProblem(''); }}>Edit engagement</button>
        <span className="action-split" aria-hidden="true" />
        <ArchiveButton workspaceId={workspaceId} resource="engagements" id={engagement.id} what="engagement"
          name={engagement.objective} className="secondary"
          keeps={person ? `${person.displayName} stays in this workspace, along with their other engagements.` : undefined}
          onArchived={() => { setNotice('Engagement archived.'); onChanged(); }}
          onProblem={setProblem} />
        <PermanentDeleteButton workspaceId={workspaceId} resource="engagements" id={engagement.id} what="engagement"
          name={engagement.objective} className="secondary danger"
          warning="This also removes meetings, notes, follow-ups and timeline activity for this engagement."
          onDeleted={() => { setNotice('Engagement deleted.'); onChanged(); }}
          onProblem={setProblem} />
      </div>}
    </header>

    {/* How far along the pipeline this is, at a glance. */}
    {index >= 0 && <div className="steps" role="img"
      aria-label={`Step ${index + 1} of ${open.length} in this pipeline: ${stage?.name ?? ''}`}>
      {open.map((row, position) => <span key={row.id} className={position <= index ? 'on' : ''} />)}
    </div>}

    {help && <p className="intro">{help.meaning} <span className="quiet">{help.prompt}</span></p>}

    {notice && <p role="status" className="notice">{notice}</p>}
    {problem && <p role="alert">{problem}</p>}

    {inviting && <OutreachComposer workspaceId={workspaceId} engagementId={engagement.id} person={person}
      initialPurpose={engagement.objective} onClose={() => setInviting(false)} onSent={() => { setNotice('Invitation sent and added to the engagement timeline.'); onChanged(); }} />}

    {/* Where it stands, where it goes next, and what is owed — one labelled row. */}
    <div className="engagement-state">
      <div className="field">
        <span className="field-label" id={`detail-stage-label-${engagement.id}`}>Stage</span>
        <FormSelect id={`detail-stage-${engagement.id}`} aria-label="Stage" value={stage ? engagement.stageId : ''} disabled={pending}
          placeholder="Choose a stage" onValueChange={moveTo}
          options={[...open.map(option => ({value:option.id,label:option.name})), ...(stage?.archived ? [{value:stage.id,label:`${stage.name} (retired)`}] : [])]} />
      </div>
      <div className="field">
        <span className="field-label">Status</span>
        <FormSelect id={`detail-status-${engagement.id}`} aria-label="Status" value={engagement.status} disabled={pending}
          onValueChange={setStatus}
          options={[...new Set([engagement.status, ...engagementStatuses])].map(value => ({value, label: value.replace('_', ' ').toLowerCase()}))} />
      </div>
      <div className="next">
        <p className="eyebrow">Next action</p>
        {nextActions.length
          ? <ul className="point-list plain-points">{nextActions.map((action, at) => <li key={at}>{action}</li>)}</ul>
          : <p className="small">None recorded.</p>}
      </div>
    </div>

    {/* The one thing this stage is asking for. */}
    {recording && <form className="record-form" onSubmit={event => { event.preventDefault(); record(new FormData(event.currentTarget)); }}>
      <h4 className="record-title">{step?.action ?? 'Record what happened'}</h4>
      <label className="field">
        <span className="field-label">{step?.noteLabel ?? 'What happened?'}</span>
        <textarea name="body" rows={3} maxLength={20000} required autoFocus placeholder={step?.notePlaceholder} />
      </label>
      {/* Offered wherever a conversation is being closed out. */}
      {(step?.advanceTo === 'Completed' || step?.advanceTo === 'Follow-up') && <div className="field">
        <span className="field-label">Outcome</span>
        <FormSelect aria-label="Outcome" value={outcome} onValueChange={setOutcome}
          options={[{value:'',label:'No outcome recorded'}, ...outcomes.map(value => ({value,label:value}))]} />
        <span className="small">The backend has no outcome column, so your choice is saved at the front of the note.</span>
      </div>}
      {step?.task && <div className="field-grid">
        <label className="field">
          <span className="field-label">{step.task.label}</span>
          <input name="taskTitle" maxLength={500} placeholder={step.task.placeholder} />
        </label>
        <div className="field">
          <span className="field-label">Due</span>
          <DatePicker name="taskDue" aria-label="Due" value={taskDue} onChange={setTaskDue} />
        </div>
      </div>}
      <label className="field">
        <span className="field-label">Next action</span>
        <input name="nextAction" maxLength={2000} defaultValue={engagement.nextAction ?? ''} />
      </label>
      {target && <label className="choice">
        <input type="checkbox" name="advance" defaultChecked />
        Move to <strong>{target.name}</strong>
      </label>}
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={() => { setRecording(false); setOutcome(''); }}>Cancel</button>
        <button disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
      </div>
    </form>}

    {step?.scheduling && <p role="note" className="aside">
      Meetings are created on the <Link className="text-link" href={`/app/${workspaceId}/calendar`}>Meetings</Link> screen, where you
      choose the calendar account, time and conference. Link the meeting to this engagement there and it will appear below.
    </p>}

    {/* What is booked and what is owed, side by side — the same shape as the person's notes and tasks. */}
    <div className="two-up engagement-lists">
      <div>
        <h4>Meetings</h4>
        {!data.meetings.rows && <p role="status">Loading meetings…</p>}
        {data.meetings.rows && meetings.length === 0 && <Empty>No meeting is linked to this engagement yet.</Empty>}
        {upcoming.map(meeting => <MeetingRow key={meeting.id} workspaceId={workspaceId} meeting={meeting} upcoming />)}
        {past.map(meeting => <MeetingRow key={meeting.id} workspaceId={workspaceId} meeting={meeting} />)}
      </div>
      <div>
        <h4>Follow-ups</h4>
        {!data.tasks.rows && <p role="status">Loading follow-ups…</p>}
        {data.tasks.rows && tasks.length === 0 && <Empty>Nothing is owed on this engagement.</Empty>}
        <ul className="tasks">{tasks.map(task => <li key={task.id}>
          <span>{task.title}
            <span className="small"> — {task.status}{task.dueAt ? `, due ${new Date(task.dueAt).toLocaleDateString()}` : ', no date'}</span>
          </span>
          <span className="row-actions">
            {task.status !== 'DONE' && <button className="secondary small-button" disabled={pending} onClick={() => completeTask(task)}>
              Mark done<span className="sr-only"> — {task.title}</span>
            </button>}
            <button className="secondary small-button" onClick={() => { setEditingTask(task); setNotice(''); setProblem(''); }}>
              Edit<span className="sr-only"> {task.title}</span>
            </button>
            <ArchiveButton workspaceId={workspaceId} resource="tasks" id={task.id} name={task.title} what="follow-up"
              onArchived={() => { setNotice('Follow-up archived.'); onChanged(); }} onProblem={setProblem} />
            <PermanentDeleteButton workspaceId={workspaceId} resource="tasks" id={task.id} name={task.title} what="follow-up"
              onDeleted={() => { setNotice('Follow-up deleted.'); onChanged(); }} onProblem={setProblem} />
          </span>
        </li>)}</ul>
      </div>
    </div>

    <h4>What was said</h4>
    {!data.notes.rows && <p role="status">Loading notes…</p>}
    {data.notes.rows && notes.length === 0 && <Empty>Nothing has been recorded on this engagement yet.</Empty>}
    <ul className="notes">{[...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((note: Note) => <li key={note.id}>
      <p>{note.body}</p>
      <p className="small">{new Date(note.createdAt).toLocaleString()}
        {note.updatedAt !== note.createdAt && ` · edited ${new Date(note.updatedAt).toLocaleString()}`}</p>
      <p className="row-actions">
        <button className="secondary small-button" onClick={() => { setEditingNote(note); setNotice(''); setProblem(''); }}>
          Edit<span className="sr-only"> note</span>
        </button>
        <ArchiveButton workspaceId={workspaceId} resource="notes" id={note.id} what="note"
          name={note.body.length > 60 ? `${note.body.slice(0, 60)}…` : note.body}
          onArchived={() => { setNotice('Note archived.'); onChanged(); }} onProblem={setProblem} />
        <PermanentDeleteButton workspaceId={workspaceId} resource="notes" id={note.id} what="note"
          name={note.body.length > 60 ? `${note.body.slice(0, 60)}…` : note.body}
          onDeleted={() => { setNotice('Note deleted.'); onChanged(); }} onProblem={setProblem} />
      </p>
    </li>)}</ul>

    {editingEngagement && <Modal title="Edit this engagement" description="What you are trying to achieve, what is next, and where it stands."
      onClose={() => setEditingEngagement(false)}>
      <EngagementEditor engagement={engagement}
        onSave={async body => { if (await change('engagements', engagement.id, body, 'Engagement updated.')) setEditingEngagement(false); }}
        onCancel={() => setEditingEngagement(false)} />
    </Modal>}

    {editingNote && <Modal title="Edit this note" description="Notes are a record of what was said. Correcting one does not hide that it changed."
      onClose={() => setEditingNote(undefined)}>
      <NoteEditor note={editingNote}
        onSave={async body => { if (await change('notes', editingNote.id, body, 'Note updated.')) setEditingNote(undefined); }}
        onCancel={() => setEditingNote(undefined)} />
    </Modal>}

    {editingTask && <Modal title="Edit this follow-up" description="Change what is owed, when it is due, or where it stands."
      onClose={() => setEditingTask(undefined)}>
      <TaskEditor task={editingTask}
        onSave={async body => { if (await change('tasks', editingTask.id, body, 'Follow-up updated.')) setEditingTask(undefined); }}
        onCancel={() => setEditingTask(undefined)} />
    </Modal>}
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
