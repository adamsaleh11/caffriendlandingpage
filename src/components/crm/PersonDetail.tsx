'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { statusLabels, type Note, type Person, type Pipeline as PipelineRecord, type Task } from '@/lib/contracts';
import { useKeys, useRows, Empty, Evidence, Rights } from './common';
import { provenanceFor, timelineFor, useAllStages, useEngagementTimelines, useWorkspaceData, type TimelineEntry } from './workspace-data';
import { mergeTimeline } from '@/lib/engagement-timeline';
import { completeness, sourceLabel, talkingPoints, talkingPointsText, type ProfileField } from './person-profile';
import StateCard from './StateCard';
import EngagementForm from './EngagementForm';
import Relationship from './Relationship';
import Modal from './Modal';
import { ProfileEditor } from './PersonForm';
import { ArchiveButton, PermanentDeleteButton, editRecord, problemText } from './record-actions';
import { NoteEditor, TaskEditor } from './RecordEditors';
import { canonicalPipeline } from '@/lib/lifecycle';

type Permissions = { id: string; permittedUses: string[]; blocked: boolean };

const percent = (value: number) => `${Math.round(value * 100)}%`;
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('');

/**
 * One person, and everything the workspace knows about pursuing them.
 *
 * The page is ordered by what a person actually needs from it: who they are and
 * how complete the record is, what to know before the next conversation, what is
 * in flight, and only then the provenance and history that answer questions
 * nobody asks every day.
 */
export default function PersonDetail({workspaceId, personId}:{workspaceId:string; personId:string}) {
  const [person, setPerson] = useState<Person>();
  const [error, setError] = useState<ApiError>();
  const [permissions, setPermissions] = useState<Permissions | 'unavailable'>();
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [startingEngagement, setStartingEngagement] = useState(false);
  /** The profile editor, opened either at the first gap or at a named field. */
  const [editing, setEditing] = useState<{startAt?: ProfileField['name']}>();
  const [editingNote, setEditingNote] = useState<Note>();
  const [editingTask, setEditingTask] = useState<Task>();
  const keyFor = useKeys();
  const router = useRouter();

  const data = useWorkspaceData(workspaceId);
  const timelineItems = useEngagementTimelines(
    workspaceId, (data.engagements.rows ?? []).filter(row => row.personId === personId).map(row => row.id));
  const pipelines = useRows<PipelineRecord>(`workspaces/${workspaceId}/pipelines`);
  const stages = useAllStages(workspaceId, pipelines.rows);

  useEffect(() => {
    const controller = new AbortController();
    setPerson(undefined); setError(undefined);
    api<Person>(`workspaces/${workspaceId}/crm/people/${personId}`, {signal: controller.signal})
      .then(row => { if (!controller.signal.aborted) setPerson(row); })
      .catch(problem => { if (!controller.signal.aborted) setError(problem instanceof ApiError ? problem : new ApiError(503, 'This person is unavailable right now.')); });
    // What this person may actually be used for is decided by the server, never here.
    api<Permissions>(`workspaces/${workspaceId}/crm/people/${personId}/permissions`, {signal: controller.signal})
      .then(row => { if (!controller.signal.aborted) setPermissions(row); })
      .catch(() => { if (!controller.signal.aborted) setPermissions('unavailable'); });
    return () => controller.abort();
  }, [workspaceId, personId, attempt]);

  if (error) return <StateCard
    title={error.status === 403 ? 'You do not have access to this person' : error.status === 404 ? 'Person not found' : 'Unable to load this person'}
    message={error.status === 404 ? 'This person may have been archived, or the link may be wrong.' : error.message}
    retry={error.status === 403 || error.status === 404 ? undefined : () => setAttempt(v => v + 1)} />;
  if (!person) return <p role="status">Loading person…</p>;

  const theirEngagements = (data.engagements.rows ?? []).filter(row => row.personId === personId);
  const engagementIds = new Set(theirEngagements.map(row => row.id));
  const organization = person.organizationId ? (data.organizations.rows ?? []).find(row => row.id === person.organizationId) : undefined;
  const provenance = provenanceFor(personId, data);
  /**
   * The acceptance rows come from the server's engagement timeline, which is the
   * record that already holds who answered — merged with, not replacing, the
   * send-time note. Send and answer are two moments.
   */
  const timeline = mergeTimeline({
    entries: timelineFor(personId, engagementIds, data),
    items: timelineItems.filter(item => !item.engagementId || engagementIds.has(item.engagementId)),
    person,
    agents: data.agents.rows ?? [],
  });
  /** Notes and tasks not attached to any one engagement still belong to the person. */
  const looseNotes = (data.notes.rows ?? []).filter(row => row.personId === personId && !row.engagementId);
  const looseTasks = (data.tasks.rows ?? []).filter(row => row.personId === personId && !row.engagementId);
  const progress = completeness(person);

  /* What the next conversation actually needs, gathered from records that already exist. */
  const theirNotes = (data.notes.rows ?? []).filter(row => row.personId === personId);
  const lastSaid: Note | undefined = [...theirNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const openTasks = (data.tasks.rows ?? []).filter(row => row.personId === personId && row.status !== 'DONE');
  const nextMeeting = (data.meetings.rows ?? [])
    .filter(row => row.engagementId && engagementIds.has(row.engagementId) && row.status !== 'CANCELLED' && Date.parse(row.endsAt) >= Date.now())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const nextActions = theirEngagements.map(row => row.nextAction).filter(Boolean) as string[];

  const refresh = () => {
    data.engagements.reload(); data.notes.reload(); data.tasks.reload();
    data.events.reload(); data.meetings.reload();
  };

  async function add(resource: 'notes'|'tasks', body: Record<string,unknown>, reload: () => void, form: HTMLFormElement) {
    setProblem(''); setNotice('');
    try {
      await api(`workspaces/${workspaceId}/crm/${resource}`, {method:'POST', body: JSON.stringify({...body, personId}), headers:{'X-Idempotency-Key': keyFor(`${resource}:${JSON.stringify(body)}`)}});
      form.reset(); reload(); setNotice(resource === 'notes' ? 'Note added.' : 'Task created.');
      data.events.reload();
    } catch (error) { setProblem(error instanceof ApiError ? error.message : 'That did not save.'); }
  }

  /** One edit of an existing note or task, reported as saved only when it was. */
  async function change(resource: 'notes'|'tasks', id: string, body: Record<string,unknown>, reload: () => void, message: string) {
    setProblem(''); setNotice('');
    try {
      await editRecord(workspaceId, resource, id, body);
      reload(); data.events.reload(); setNotice(message);
      return true;
    } catch (error) { setProblem(problemText(error, 'That change did not save.')); return false; }
  }

  return <>
    <p className="eyebrow"><Link href={`/app/${workspaceId}/people`}>← People</Link></p>

    <header className="person-head">
      <span className="avatar large" aria-hidden="true">{initials(person.displayName)}</span>
      <div className="person-head-text">
        <h1>{person.displayName}</h1>
        <p className="small">{[person.title, organization?.name, person.location].filter(Boolean).join(' · ') || 'No role or organization recorded yet.'}</p>
        <p className="chips">
          {person.email && <a className="chip" href={`mailto:${person.email}`} title={person.email}><span className="chip-icon" aria-hidden="true">✉</span>{person.email}</a>}
          {/* Not a tel: link. That hands the number to the OS dialler — FaceTime on
            a Mac — so glancing at a profile is one stray click from calling
            someone. The number is here to be read and taken away. */}
          {person.phone && <button type="button" className="chip" aria-label={`Copy phone number ${person.phone}`}
            onClick={async () => {
              setProblem('');
              try { await navigator.clipboard.writeText(person.phone!); setNotice(`Phone number copied: ${person.phone}`); }
              catch { setNotice(`Phone number: ${person.phone}`); }
            }}><span className="chip-icon" aria-hidden="true">✆</span>{person.phone}</button>}
          {person.sourceUrl && <a className="chip" href={person.sourceUrl} target="_blank" rel="noreferrer noopener"><span className="chip-icon" aria-hidden="true">↗</span>Profile</a>}
        </p>
      </div>
      <div className="person-head-actions">
        <button onClick={() => { setStartingEngagement(true); setNotice(''); }}>Start an engagement</button>
        <button className="secondary" onClick={() => { setEditing({startAt:'displayName'}); setNotice(''); }}>
          Edit profile
        </button>
        <button className="secondary" onClick={() => { setEditing({}); setNotice(''); }}>
          {progress.missing.length ? 'Complete profile' : 'Review profile'}
        </button>
        <ArchiveButton workspaceId={workspaceId} resource="people" id={person.id} name={person.displayName} what="person"
          className="secondary" label="Archive person"
          keeps={theirEngagements.length
            ? `Their ${theirEngagements.length === 1 ? 'engagement stays' : `${theirEngagements.length} engagements stay`} on the pipeline board unless you archive each one too.`
            : undefined}
          onArchived={() => router.push(`/app/${workspaceId}/people`)}
          onProblem={setProblem} />
        <PermanentDeleteButton workspaceId={workspaceId} resource="people" id={person.id} name={person.displayName} what="person"
          className="secondary danger" label="Delete person"
          warning={theirEngagements.length
            ? `This also removes their engagements, meetings, notes, tasks and CRM source claims.`
            : 'This also removes their notes, tasks and CRM source claims.'}
          onDeleted={() => router.push(`/app/${workspaceId}/people`)}
          onProblem={setProblem} />
      </div>
    </header>

    {notice && <p role="status" className="notice">{notice}</p>}
    {problem && <p role="alert">{problem}</p>}

    {/* How much of this person you actually have, and the shortest way to the rest. */}
    <section className="card progress-card">
      <div className="progress-head">
        <h2>Profile</h2>
        <p className="small">{progress.filled} of {progress.total} details on file</p>
      </div>
      <div className="meter" role="img" aria-label={`Profile ${progress.filled} of ${progress.total} details on file`}>
        <span style={{width: `${Math.round(progress.ratio * 100)}%`}} />
      </div>
      {progress.missing.length === 0
        ? <p className="small">Everything worth knowing before a chat is recorded.</p>
        : <p className="chips">
            {progress.missing.map(field => <button key={field.name} type="button" className="chip add"
              onClick={() => { setEditing({startAt: field.name}); setNotice(''); }}><span className="chip-icon" aria-hidden="true">+</span>{field.label}</button>)}
          </p>}
    </section>

    {/* The five-minute read before a call, assembled from records that already exist. */}
    <section className="card prep">
      <h2>Before your next chat</h2>
      <div className="prep-grid">
        <div>
          <p className="eyebrow">Next meeting</p>
          {nextMeeting
            ? <p><Link href={`/app/${workspaceId}/meetings/${nextMeeting.id}`}>{nextMeeting.purpose}</Link>
                <span className="small"><br/>{new Date(nextMeeting.startsAt).toLocaleString()} · {statusLabels[nextMeeting.status] ?? nextMeeting.status}</span></p>
            : <p className="small">Nothing booked.</p>}
        </div>
        <div>
          <p className="eyebrow">Next action</p>
          {nextActions.length
            ? <ul className="plain">{nextActions.map((action, index) => <li key={index}>{action}</li>)}</ul>
            : <p className="small">None recorded.</p>}
        </div>
        <div>
          <p className="eyebrow">Owed to them</p>
          {openTasks.length
            ? <ul className="plain">{openTasks.slice(0, 3).map(task => <li key={task.id}>{task.title}
                {task.dueAt && <span className="small"> · due {new Date(task.dueAt).toLocaleDateString()}</span>}</li>)}</ul>
            : <p className="small">Nothing outstanding.</p>}
        </div>
        <div>
          <p className="eyebrow">Last thing said</p>
          {lastSaid
            ? <p>{lastSaid.body}<span className="small"><br/>{new Date(lastSaid.createdAt).toLocaleString()}</span></p>
            : <p className="small">Nothing recorded yet.</p>}
        </div>
      </div>
      <TalkingPoints workspaceId={workspaceId} person={person}
        onSaved={row => { setPerson(row); setProblem(''); }} onProblem={setProblem} />
    </section>

    <section className="card">
      <h2>Where this stands</h2>
      <p className="small">
        An engagement is one effort with this person. Someone can carry more than one at a time — a role and
        an introduction, say — each at its own point in its own pipeline.
      </p>
      {!data.engagements.rows && <p role="status">Loading engagements…</p>}
      {stages.error && <p role="alert">Pipeline steps could not be loaded, so stages may show as unavailable. <button className="secondary" onClick={stages.reload}>Try again</button></p>}
      {data.engagements.rows && theirEngagements.length === 0 &&
        <Empty>Nothing is in flight with this person yet. Start an engagement to begin the lifecycle.</Empty>}

      {theirEngagements.map(engagement => <Relationship
        key={engagement.id}
        workspaceId={workspaceId}
        engagement={engagement}
        stages={(stages.byPipeline?.[engagement.pipelineId] ?? []).filter(stage=>canonicalPipeline.stages.some(step=>step.name.toLowerCase()===stage.name.toLowerCase()))}
        data={data}
        onChanged={refresh} />)}
    </section>

    {/* Anything recorded about the person rather than about one effort. */}
    <section className="card">
      <h2>Notes and tasks</h2>
      <div className="two-up">
        <div>
          <h3>Notes</h3>
          {!data.notes.rows && <p role="status">Loading notes…</p>}
          {data.notes.rows && looseNotes.length === 0 && <Empty>No general notes. Notes about a specific effort sit with that engagement above.</Empty>}
          <ul className="notes">{looseNotes.map(note => <li key={note.id}>
            <p>{note.body}</p>
            <p className="small">{new Date(note.createdAt).toLocaleString()}
              {note.updatedAt !== note.createdAt && ` · edited ${new Date(note.updatedAt).toLocaleString()}`}</p>
            <p className="row-actions">
              <button type="button" className="secondary small-button" onClick={() => { setEditingNote(note); setNotice(''); setProblem(''); }}>
                Edit<span className="sr-only"> note</span>
              </button>
              <ArchiveButton workspaceId={workspaceId} resource="notes" id={note.id} what="note"
                name={note.body.length > 60 ? `${note.body.slice(0, 60)}…` : note.body}
                onArchived={() => { setNotice('Note archived.'); data.notes.reload(); data.events.reload(); }}
                onProblem={setProblem} />
              <PermanentDeleteButton workspaceId={workspaceId} resource="notes" id={note.id} what="note"
                name={note.body.length > 60 ? `${note.body.slice(0, 60)}…` : note.body}
                onDeleted={() => { setNotice('Note deleted.'); data.notes.reload(); data.events.reload(); }}
                onProblem={setProblem} />
            </p>
          </li>)}</ul>
          <form className="quick-add" onSubmit={event => { event.preventDefault(); const form = event.currentTarget;
            const body = String(new FormData(form).get('body') ?? '').trim();
            if (body) add('notes', {body}, data.notes.reload, form);
          }}>
            <label className="field">
              <span className="field-label">Add a note</span>
              <textarea name="body" required maxLength={20000} rows={2} placeholder="Something worth remembering" />
            </label>
            <button className="secondary">Add note</button>
          </form>
        </div>
        <div>
          <h3>Tasks</h3>
          {!data.tasks.rows && <p role="status">Loading tasks…</p>}
          {data.tasks.rows && looseTasks.length === 0 && <Empty>No general tasks.</Empty>}
          <ul className="tasks">{looseTasks.map(task => <li key={task.id}>
            {task.title}<span className="small"> — {task.status}{task.dueAt ? `, due ${new Date(task.dueAt).toLocaleDateString()}` : ''}</span>
            <p className="row-actions">
              {task.status !== 'DONE' && <button type="button" className="secondary small-button"
                onClick={() => change('tasks', task.id, {status: 'DONE'}, data.tasks.reload, `“${task.title}” marked done.`)}>
                Mark done<span className="sr-only"> — {task.title}</span>
              </button>}
              <button type="button" className="secondary small-button" onClick={() => { setEditingTask(task); setNotice(''); setProblem(''); }}>
                Edit<span className="sr-only"> {task.title}</span>
              </button>
              <ArchiveButton workspaceId={workspaceId} resource="tasks" id={task.id} name={task.title} what="task"
                onArchived={() => { setNotice('Task archived.'); data.tasks.reload(); data.events.reload(); }}
                onProblem={setProblem} />
              <PermanentDeleteButton workspaceId={workspaceId} resource="tasks" id={task.id} name={task.title} what="task"
                onDeleted={() => { setNotice('Task deleted.'); data.tasks.reload(); data.events.reload(); }}
                onProblem={setProblem} />
            </p>
          </li>)}</ul>
          <form className="quick-add" onSubmit={event => { event.preventDefault(); const form = event.currentTarget;
            const title = String(new FormData(form).get('title') ?? '').trim();
            if (title) add('tasks', {title, status:'OPEN'}, data.tasks.reload, form);
          }}>
            <label className="field">
              <span className="field-label">Add a task</span>
              <input name="title" required maxLength={500} placeholder="Send the portfolio" />
            </label>
            <button className="secondary">Add task</button>
          </form>
        </div>
      </div>
    </section>

    {/* Answered here rather than at the top: it matters, but not on every visit. */}
    <section className="card provenance">
      <h2>Where they came from, and what you may do</h2>
      <p className="small">Added {sourceLabel(person.sourceCategory).toLowerCase()}{provenance.addedAt ? ` on ${new Date(provenance.addedAt).toLocaleDateString()}` : ''}.</p>
      <dl className="facts">
        <dt>Added by</dt>
        <dd>{provenance.addedBy
          ? provenance.addedBy.kind === 'agent'
            ? <><strong>{provenance.addedBy.name}</strong> — an agent connected to this workspace{provenance.viaApproval ? ', after you approved its proposal' : ''}. Caffriend did not find them itself.</>
            : `${provenance.addedBy.name} in this workspace`
          : 'Not recorded. No creation event is held for this person.'}</dd>
        <dt>Details obtained</dt><dd>{sourceLabel(provenance.sourceCategory)}</dd>
        <dt>Confidence</dt>
        <dd>{provenance.confidence !== null
          ? <>{percent(provenance.confidence)} — the highest confidence recorded on a cited claim about them.</>
          : 'No confidence is recorded, because nothing about this person is cited to a source.'}</dd>
        <dt>Permitted uses</dt>
        <dd>
          {permissions === undefined && <span role="status">Checking permitted uses…</span>}
          {permissions === 'unavailable' && <span role="alert"><span className="verdict blocked">Unknown</span> Permitted uses could not be checked, so outreach, export and republication should be treated as blocked until this loads.</span>}
          {permissions && permissions !== 'unavailable' && (permissions.blocked
            ? <span role="alert"><span className="verdict blocked">Blocked</span> Their source needs a rights review before they can be contacted, exported or republished.</span>
            : <><span className="verdict allowed">Permitted</span> <strong>{permissions.permittedUses.join(', ')}</strong>. Anything not listed is blocked.</>)}
        </dd>
      </dl>
      {!data.claims.rows
        ? <p role="status">Loading sources…</p>
        : <Evidence artifact={provenance.artifact} claims={provenance.claims} conversation={provenance.conversation} />}
      {provenance.artifact && <p className="small">Rights on this source: <Rights state={provenance.artifact.rightsState}/></p>}
      {/* Workspace-entered data only. Opt-in Caffriend network profiles are never shown here. */}
      <p className="small">
        Everything on this page was entered in this workspace. A Caffriend app profile is a separate, opt-in
        thing: being tracked here does not make someone a Caffriend connection.
      </p>
    </section>

    <Timeline entries={timeline} loading={!data.events.rows} />

    {startingEngagement && <Modal title="Start an engagement"
      description="One effort with this person — a role, an introduction, a partnership."
      onClose={() => setStartingEngagement(false)}>
      <EngagementForm workspaceId={workspaceId} people={[]} pipelines={pipelines.rows ?? []}
        stages={Object.values(stages.byPipeline ?? {}).flat()} personId={personId}
        onCreated={() => { setStartingEngagement(false); setNotice('Engagement started.'); refresh(); }}
        onCancel={() => setStartingEngagement(false)} />
    </Modal>}

    {editing && <Modal title={progress.missing.length ? 'Complete this profile' : 'Edit this profile'}
      description="One question at a time. Skip anything you do not know yet."
      onClose={() => setEditing(undefined)}>
      <ProfileEditor workspaceId={workspaceId} person={person} organizations={data.organizations.rows ?? []}
        startAt={editing.startAt}
        onOrganizationCreated={data.organizations.reload}
        onSaved={(saved, message) => { setPerson(saved); setNotice(message); data.people.reload(); data.events.reload(); }}
        onClose={() => setEditing(undefined)} />
    </Modal>}

    {editingNote && <Modal title="Edit this note" description="Notes are a record of what was said. Correcting one does not hide that it changed."
      onClose={() => setEditingNote(undefined)}>
      <NoteEditor note={editingNote}
        onSave={async body => { if (await change('notes', editingNote.id, body, data.notes.reload, 'Note updated.')) setEditingNote(undefined); }}
        onCancel={() => setEditingNote(undefined)} />
    </Modal>}

    {editingTask && <Modal title="Edit this task" description="Change what is owed, when it is due, or where it stands."
      onClose={() => setEditingTask(undefined)}>
      <TaskEditor task={editingTask}
        onSave={async body => { if (await change('tasks', editingTask.id, body, data.tasks.reload, 'Task updated.')) setEditingTask(undefined); }}
        onCancel={() => setEditingTask(undefined)} />
    </Modal>}
  </>;
}

/**
 * The whole history, oldest first, grouped by day.
 *
 * Agent work is labelled as agent work. The backend does not record before/after
 * values on an audit event, so an entry says what happened and who did it, and
 * does not pretend to show what changed.
 */
function Timeline({entries, loading}:{entries:TimelineEntry[]; loading:boolean}) {
  const days: [string, TimelineEntry[]][] = [];
  for (const entry of entries) {
    const day = new Date(entry.at).toDateString();
    const last = days[days.length - 1];
    if (last && last[0] === day) last[1].push(entry); else days.push([day, [entry]]);
  }
  return <section className="card">
    <h2>Timeline</h2>
    {loading && <p role="status">Loading history…</p>}
    {!loading && entries.length === 0 && <Empty>Nothing has happened with this person yet.</Empty>}
    <ol className="timeline">
      {days.map(([day, items]) => <li key={day}>
        <p className="eyebrow">{day}</p>
        <ul>{items.map(entry => <li key={entry.id} className={`entry ${entry.kind}`}>
          <p><strong>{entry.title}</strong>{' '}
            <span className={`actor ${entry.byAgent ? 'agent' : 'human'}`}>{entry.byAgent ? `${entry.actor} (agent)` : entry.actor}</span>{' '}
            <time dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString()}</time></p>
          {entry.detail && <p className="small">{entry.detail}</p>}
        </li>)}</ul>
      </li>)}
    </ol>
    <p className="small">Changes are shown as they were recorded. The backend does not store the previous and new values of an edit, so this history does not reconstruct them.</p>
  </section>;
}


/**
 * The talking points, one per line in the record and one card each on screen.
 *
 * People were already typing lists into a single box — dashes, line breaks — and
 * reading them back as a paragraph. Each point gets its own row here, and adding
 * or removing one writes the whole list back to the same field.
 */
function TalkingPoints({workspaceId, person, onSaved, onProblem}:{
  workspaceId: string; person: Person; onSaved: (person: Person) => void; onProblem: (message: string) => void;
}) {
  const points = talkingPoints(person.discoveryReason);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  async function write(next: string[]) {
    setSaving(true); onProblem('');
    try {
      const row = await editRecord<Person>(workspaceId, 'people', person.id, {discoveryReason: talkingPointsText(next) || null});
      onSaved(row?.id ? row : {...person, discoveryReason: talkingPointsText(next)});
    } catch (error) { onProblem(problemText(error, 'That talking point did not save.')); }
    finally { setSaving(false); }
  }

  const add = async () => {
    const point = draft.trim();
    if (!point || saving) return;
    setDraft('');
    await write([...points, point]);
  };

  return <div className="talking-points">
    <p className="eyebrow">What to talk about</p>
    {points.length
      ? <ul className="point-list">{points.map((point, index) => <li key={`${index}:${point}`} className="point">
          <span className="point-dot" aria-hidden="true">{index + 1}</span>
          <span className="point-text">{point}</span>
          <button type="button" className="point-remove" disabled={saving}
            aria-label={`Remove talking point: ${point}`}
            onClick={() => write(points.filter((_, at) => at !== index))}>×</button>
        </li>)}</ul>
      : <p className="small">Nothing yet. Add the things you want in front of you five minutes before the call.</p>}
    <form className="point-add" onSubmit={event => { event.preventDefault(); void add(); }}>
      <input value={draft} maxLength={2000} onChange={event => setDraft(event.target.value)}
        aria-label="Add a talking point" placeholder="Add a talking point…" />
      <button type="submit" className="secondary" disabled={saving || !draft.trim()}>{saving ? 'Saving…' : 'Add'}</button>
    </form>
  </div>;
}
