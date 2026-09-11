'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { type Person, type Pipeline as PipelineRecord } from '@/lib/contracts';
import { useKeys, useRows, Empty, Evidence, Rights } from './common';
import { provenanceFor, timelineFor, useAllStages, useWorkspaceData, type TimelineEntry } from './workspace-data';
import StateCard from './StateCard';
import EngagementForm from './EngagementForm';
import Relationship from './Relationship';

type Permissions = { id: string; permittedUses: string[]; blocked: boolean };

const percent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * One person, and everything the workspace knows about pursuing them.
 *
 * The point of this page is that nobody has to go anywhere else to understand a
 * relationship: who they are, why they are in the workspace at all, where each
 * effort with them stands, what was said, what is booked, what is owed, and the
 * order it all happened in.
 */
export default function PersonDetail({workspaceId, personId}:{workspaceId:string; personId:string}) {
  const [person, setPerson] = useState<Person>();
  const [error, setError] = useState<ApiError>();
  const [permissions, setPermissions] = useState<Permissions | 'unavailable'>();
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [startingEngagement, setStartingEngagement] = useState(false);
  const keyFor = useKeys();

  const data = useWorkspaceData(workspaceId);
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
  const timeline = timelineFor(personId, engagementIds, data);
  /** Notes and tasks not attached to any one engagement still belong to the person. */
  const looseNotes = (data.notes.rows ?? []).filter(row => row.personId === personId && !row.engagementId);
  const looseTasks = (data.tasks.rows ?? []).filter(row => row.personId === personId && !row.engagementId);

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

  return <>
    <p className="eyebrow"><Link href={`/app/${workspaceId}/people`}>← People</Link></p>
    <h1>{person.displayName}</h1>
    <p className="intro">{[person.title, organization?.name, person.location].filter(Boolean).join(' · ') || 'No role or organization recorded.'}</p>
    {notice && <p role="status" className="notice">{notice}</p>}
    {problem && <p role="alert">{problem}</p>}

    {/* Answered first, because it is the first thing anyone asks of an unfamiliar name. */}
    <section className="card provenance">
      <h2>Why they are here</h2>
      <dl>
        <dt>Added by</dt>
        <dd>{provenance.addedBy
          ? provenance.addedBy.kind === 'agent'
            ? <><strong>{provenance.addedBy.name}</strong> — an agent connected to this workspace{provenance.viaApproval ? ', after you approved its proposal' : ''}. Caffriend did not find them itself.</>
            : `${provenance.addedBy.name} in this workspace`
          : 'Not recorded. No creation event is held for this person.'}</dd>
        <dt>How their details were obtained</dt><dd>{provenance.sourceCategory}</dd>
        <dt>Confidence</dt>
        <dd>{provenance.confidence !== null
          ? <>{percent(provenance.confidence)} — the highest confidence recorded on a cited claim about them.</>
          : 'No confidence is recorded, because nothing about this person is cited to a source.'}</dd>
        <dt>Added</dt><dd>{provenance.addedAt ? new Date(provenance.addedAt).toLocaleString() : 'Not recorded'}</dd>
      </dl>
      {!data.claims.rows
        ? <p role="status">Loading sources…</p>
        : <Evidence artifact={provenance.artifact} claims={provenance.claims} conversation={provenance.conversation} />}
      {provenance.artifact && <p className="small">Rights on this source: <Rights state={provenance.artifact.rightsState}/></p>}
    </section>

    <section className="card">
      <h2>Details</h2>
      <dl>
        <dt>Email</dt><dd>{person.email || 'Not recorded'}</dd>
        <dt>Phone</dt><dd>{person.phone || 'Not recorded'}</dd>
        <dt>Location</dt><dd>{person.location || 'Not recorded'}</dd>
      </dl>
      {/* Workspace-entered data only. Opt-in Caffriend network profiles are never shown here. */}
      <p className="small">
        Everything above was entered in this workspace. A Caffriend app profile is a separate, opt-in
        thing: being tracked here does not make someone a Caffriend connection, and the backend does
        not disclose whether this record matches an app account.
      </p>
    </section>

    <section className="card">
      <h2>What you may do with this record</h2>
      {permissions === undefined && <p role="status">Checking permitted uses…</p>}
      {permissions === 'unavailable' && <p role="alert">Permitted uses could not be checked, so outreach, export and republication should be treated as blocked until this loads.</p>}
      {permissions && permissions !== 'unavailable' && (permissions.blocked
        ? <p role="alert">Nothing is permitted for this person yet. Their source needs a rights review before they can be contacted, exported or republished.</p>
        : <p>Permitted: <strong>{permissions.permittedUses.join(', ')}</strong>. Anything not listed is blocked.</p>)}
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
        stages={stages.byPipeline?.[engagement.pipelineId] ?? []}
        data={data}
        onChanged={refresh} />)}

      {startingEngagement
        ? <EngagementForm workspaceId={workspaceId} people={[]} pipelines={pipelines.rows ?? []}
            stages={Object.values(stages.byPipeline ?? {}).flat()} personId={personId}
            onCreated={() => { setStartingEngagement(false); setNotice('Engagement started.'); refresh(); }}
            onCancel={() => setStartingEngagement(false)} />
        : <button onClick={() => { setStartingEngagement(true); setNotice(''); }}>Start an engagement</button>}
    </section>

    {/* Anything recorded about the person rather than about one effort. */}
    <section className="card">
      <h2>About this person</h2>
      <h3>Notes</h3>
      {!data.notes.rows && <p role="status">Loading notes…</p>}
      {data.notes.rows && looseNotes.length === 0 && <Empty>No general notes. Notes about a specific effort sit with that engagement above.</Empty>}
      <ul className="notes">{looseNotes.map(note => <li key={note.id}>
        <p>{note.body}</p><p className="small">{new Date(note.createdAt).toLocaleString()}</p>
      </li>)}</ul>
      <form onSubmit={event => { event.preventDefault(); const form = event.currentTarget;
        const body = String(new FormData(form).get('body') ?? '').trim();
        if (body) add('notes', {body}, data.notes.reload, form);
      }}>
        <label>Add a note<textarea name="body" required maxLength={20000} rows={3} /></label>
        <button>Add note</button>
      </form>

      <h3>Tasks</h3>
      {!data.tasks.rows && <p role="status">Loading tasks…</p>}
      {data.tasks.rows && looseTasks.length === 0 && <Empty>No general tasks.</Empty>}
      <ul className="tasks">{looseTasks.map(task => <li key={task.id}>
        {task.title}<span className="small"> — {task.status}{task.dueAt ? `, due ${new Date(task.dueAt).toLocaleDateString()}` : ''}</span>
      </li>)}</ul>
      <form onSubmit={event => { event.preventDefault(); const form = event.currentTarget;
        const title = String(new FormData(form).get('title') ?? '').trim();
        if (title) add('tasks', {title, status:'OPEN'}, data.tasks.reload, form);
      }}>
        <label>Add a task<input name="title" required maxLength={500} /></label>
        <button>Add task</button>
      </form>
    </section>

    <Timeline entries={timeline} loading={!data.events.rows} />
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
    <p className="small quiet">Changes are shown as they were recorded. The backend does not store the previous and new values of an edit, so this history does not reconstruct them.</p>
  </section>;
}
