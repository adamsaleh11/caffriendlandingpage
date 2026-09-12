'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type { Engagement, Pipeline as PipelineRecord, Stage, Task } from '@/lib/contracts';
import { canonicalPipeline, guidanceFor, isCanonical } from '@/lib/lifecycle';
import { useKeys, useRows, Section, Empty, More } from './common';
import { lastActivity, provenanceFor, timelineFor, useWorkspaceData } from './workspace-data';
import EngagementForm from './EngagementForm';
import OutreachComposer from './OutreachComposer';
import StepFlow, { type FlowStep, type StepIcon } from './StepFlow';
import {FormSelect} from '@/components/ui/form-select';

/**
 * Starting points for a new workspace.
 *
 * The five names stay stable so invitation acceptance can move an engagement to
 * the booking step without guessing how a workspace renamed it.
 */
const templates = [
  { name: 'Coffee chats', purpose: 'Invite people, book coffee chats, and keep the follow-up moving.', stages: canonicalPipeline.stages },
];

const percent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * A picture for each lifecycle step. Unknown names fall back to a flag rather
 * than to nothing, so a workspace with an older stage name still draws a run.
 */
const stepIcons: Record<string, StepIcon> = {
  'prospect': 'prospect', 'contacted': 'message', 'meeting booked': 'calendar',
  'follow-up': 'followup', 'closed': 'closed',
};
/** The one line of who-they-are, or nothing at all when nothing is recorded. */
const role = (person?: {title?: string|null; location?: string|null}, organization?: {name: string}) =>
  [person?.title, organization?.name, person?.location].filter(Boolean).join(' · ');

const iconFor = (name: string): StepIcon => stepIcons[name.trim().toLowerCase()] ?? 'flag';

export default function Pipeline({workspaceId}:{workspaceId:string}) {
  const [selected, setSelected] = useState<string>();
  const [view, setView] = useState<'board'|'table'>('board');
  const [editingStages, setEditingStages] = useState(false);
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [moving, setMoving] = useState<string>();
  const [building, setBuilding] = useState('');
  const [inviting, setInviting] = useState<Engagement>();
  /** The engagement whose optional last step is being written, if any. */
  const [addingFinal, setAddingFinal] = useState<string>();
  const keyFor = useKeys();

  const pipelines = useRows<PipelineRecord>(`workspaces/${workspaceId}/pipelines`);
  const live = (pipelines.rows ?? []).filter(row => !row.archived);
  const pipelineId = selected && live.some(row => row.id === selected) ? selected : live[0]?.id;
  const pipeline = live.find(row => row.id === pipelineId);

  const stages = useRows<Stage>(pipelineId ? `workspaces/${workspaceId}/pipelines/${pipelineId}/stages` : null);
  const data = useWorkspaceData(workspaceId, pipelineId);
  const engagements = data.engagements;
  const people = new Map((data.people.rows ?? []).map(row => [row.id, row]));
  const organizations = new Map((data.organizations.rows ?? []).map(row => [row.id, row]));

  const stageNames = new Set(canonicalPipeline.stages.map(stage => stage.name.toLowerCase()));
  const openStages = (stages.rows ?? []).filter(stage => !stage.archived && stageNames.has(stage.name.toLowerCase()));
  /** Terminal stages are real stages, kept out of the active run so it stays readable. */
  const flow = openStages.filter(stage => !stage.terminalOutcome);
  const terminal = openStages.filter(stage => !!stage.terminalOutcome);
  const lifecycle = isCanonical(openStages.map(stage => stage.name));

  /**
   * Where an engagement actually sits on today's board.
   *
   * Rows written before the lifecycle settled still name older steps, so those
   * names are read onto the step that replaced them. This never writes anything:
   * it only decides which column and which bubble a row is drawn under.
   */
  const targetStageId = (row: Engagement) => {
    const actual = (stages.rows ?? []).find(item => item.id === row.stageId)?.name.toLowerCase();
    const mapped = actual === 'qualified' ? 'prospect'
      : actual === 'engaged' || actual === 'scheduling' ? 'contacted'
      : actual === 'completed' || actual === 'relationship' ? 'follow-up' : actual;
    return openStages.find(item => item.name.toLowerCase() === mapped)?.id ?? row.stageId;
  };

  /**
   * The optional last step of one engagement is a task on that engagement: the
   * backend already owns tasks, and a step that must be finished by someone is
   * exactly what a task is. The most recent one is the step shown on the end of
   * the run; older ones stay visible on the person's page as before.
   */
  const finalStepOf = (engagement: Engagement) => (data.tasks.rows ?? [])
    .filter(row => row.engagementId === engagement.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] as Task | undefined;

  async function writeFinalStep(path: string, method: string, body: unknown, key: string, message: string) {
    setProblem(''); setNotice('');
    try {
      await api(`workspaces/${workspaceId}/crm/${path}`, {method, body: JSON.stringify(body), headers:{'X-Idempotency-Key': keyFor(key)}});
      setNotice(message); data.tasks.reload(); data.events.reload(); return true;
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That last step did not save.'); return false;
    }
  }

  async function configure(path: string, method: string, body: unknown, key: string, after: () => void) {
    setProblem(''); setNotice('');
    try { await api(path, {method, body: JSON.stringify(body), headers:{'X-Idempotency-Key': keyFor(key)}}); after(); }
    catch (error) { setProblem(error instanceof ApiError ? error.message : 'That change did not save.'); }
  }

  /**
   * Movement is optimistic, but the server is the authority: on any failure the
   * previous rows are restored exactly and the list refetched, so the board can
   * never keep a position the server did not accept.
   */
  async function move(engagement: Engagement, stageId: string) {
    if (stageId === engagement.stageId) return;
    const before = engagements.rows ?? [];
    const to = openStages.find(stage => stage.id === stageId)?.name ?? 'the new stage';
    setMoving(engagement.id); setProblem(''); setNotice('');
    engagements.set(before.map(row => row.id === engagement.id ? {...row, stageId} : row));
    try {
      const saved = await api<Engagement>(`workspaces/${workspaceId}/crm/engagements/${engagement.id}`, {
        method:'PATCH', body: JSON.stringify({stageId}),
        headers:{'X-Idempotency-Key': keyFor(`move:${engagement.id}:${stageId}`)},
      });
      engagements.set((engagements.rows ?? before).map(row => row.id === engagement.id ? {...row, ...saved} : row));
      setNotice(`Moved to ${to}.`);
      data.events.reload();
    } catch (error) {
      engagements.set(before);
      setProblem(error instanceof ApiError ? error.message : 'That move did not save, so it has been undone.');
      engagements.reload();
    } finally { setMoving(undefined); }
  }

  /** Creates the pipeline, then its stages in order, then selects it. */
  async function build(name: string, purpose: string, steps: typeof canonicalPipeline.stages) {
    setBuilding(name); setProblem('');
    try {
      const created = await api<PipelineRecord>(`workspaces/${workspaceId}/pipelines`, {
        method:'POST', body: JSON.stringify({name, purpose}),
        headers:{'X-Idempotency-Key': keyFor(`pipeline:${name}`)},
      });
      for (const step of steps)
        await api(`workspaces/${workspaceId}/pipelines/${created.id}/stages`, {
          method:'POST',
          body: JSON.stringify(step.terminalOutcome ? {name: step.name, terminalOutcome: step.terminalOutcome} : {name: step.name}),
          headers:{'X-Idempotency-Key': keyFor(`stage:${created.id}:${step.name}`)},
        });
      setSelected(created.id);
      setNotice(`${name} is ready. Add the people you want to reach, then start an engagement for each one.`);
      pipelines.reload();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That pipeline was not created.');
      pipelines.reload();
    } finally { setBuilding(''); }
  }

  /** Everything one card needs, assembled from records the workspace already has. */
  function context(engagement: Engagement) {
    const person = engagement.personId ? people.get(engagement.personId) : undefined;
    const organization = (engagement.organizationId && organizations.get(engagement.organizationId))
      || (person?.organizationId ? organizations.get(person.organizationId) : undefined);
    const provenance = person ? provenanceFor(person.id, data) : null;
    const activity = person ? lastActivity(timelineFor(person.id, new Set([engagement.id]), data)) : null;
    return {person, organization, provenance, activity};
  }

  // ---- First run: no pipeline yet ----
  if (pipelines.rows && live.length === 0) return <section className="card">
    <h1>Pipeline</h1>
    <p className="intro">
      A pipeline is the path a person travels, from a name you have just found to a relationship worth keeping.
      Caffriend&apos;s lifecycle is <strong>{canonicalPipeline.stages.filter(step => !step.terminalOutcome).map(step => step.name).join(' → ')}</strong>.
      Caffriend keeps these five steps stable so accepted invitations always move to the right place.
    </p>
    {problem && <p role="alert">{problem}</p>}
    <ul className="templates">
      {templates.map(template => <li key={template.name}>
        <h2>{template.name}</h2>
        <p>{template.purpose}</p>
        <p className="small">{template.stages.map(step => step.name).join(' → ')}</p>
        <button disabled={!!building} onClick={() => build(template.name, template.purpose, template.stages)}>
          {building === template.name ? 'Setting up…' : 'Use this'}
        </button>
      </li>)}
    </ul>
  </section>;

  const cards = engagements.rows ?? [];
  const nothingYet = !!engagements.rows && cards.length === 0;

  /** The shared pipeline steps, marked against where this one engagement stands. */
  const journey = (engagement: Engagement): FlowStep[] => {
    const here = flow.findIndex(stage => stage.id === targetStageId(engagement));
    // Not on the active run at all means it finished: everything behind it is done.
    const reached = here === -1 ? flow.length : here;
    return flow.map((stage, index) => ({
      key: stage.id,
      label: stage.name,
      icon: iconFor(stage.name),
      state: index < reached ? 'done' : index === reached ? 'current' : 'todo',
      hint: `${stage.name} — ${index < reached ? 'done' : index === reached ? 'where this stands now' : 'still ahead'}. Move here.`,
      onSelect: moving === engagement.id ? undefined : () => move(engagement, stage.id),
    }));
  };

  /**
   * The bubble past the end of the line: either the last step this engagement
   * has been given, or an invitation to add one.
   */
  const finalBubble = (engagement: Engagement): FlowStep => {
    const step = finalStepOf(engagement);
    if (!step) return {
      key: `add-${engagement.id}`, label: 'Add a last step', icon: 'plus', state: 'todo',
      hint: `Add an optional last step to ${engagement.objective}`,
      onSelect: () => { setAddingFinal(engagement.id); setNotice(''); setProblem(''); },
    };
    const done = step.status === 'DONE';
    return {
      key: step.id, label: step.title, icon: 'flag', state: done ? 'done' : 'current',
      sub: step.dueAt ? `by ${new Date(step.dueAt).toLocaleDateString()}` : undefined,
      hint: `Last step: ${step.title}${done ? ' — done' : '. Mark it done'}${step.dueAt ? `, due ${new Date(step.dueAt).toLocaleDateString()}` : ''}`,
      onSelect: done ? undefined : () => writeFinalStep(`tasks/${step.id}`, 'PATCH', {status: 'DONE'}, `final-done:${step.id}`, `“${step.title}” marked done.`),
    };
  };

  /**
   * The last-step bubble is the only one whose meaning is not already written at
   * the top of the column, so it is the only one named in words underneath.
   */
  const stepCaption = (engagement: Engagement) => {
    const step = finalStepOf(engagement);
    return step ? `Last: ${step.title}${step.status === 'DONE' ? ' ✓' : ''}` : '';
  };

  const card = (engagement: Engagement, column: number, all: Stage[]) => {
    const {person, organization, provenance, activity} = context(engagement);
    const busy = moving === engagement.id;
    return <li key={engagement.id} className="engagement">
      {/* The person leads: that is who you are actually tracking. */}
      <p className="who">{engagement.personId
        ? <Link href={`/app/${workspaceId}/people/${engagement.personId}`}>{person?.displayName ?? 'Person unavailable'}</Link>
        : 'No person linked'}</p>
      {role(person, organization) && <p className="small role">{role(person, organization)}</p>}
      <p className="objective">{engagement.objective}</p>

      {/* An agent finding someone is worth saying on the card. A person adding
          them by hand is not: it is the ordinary case, and the person's page
          carries the full provenance either way. */}
      {provenance?.addedBy?.kind === 'agent' && <p className="small source">
        Found by <strong>{provenance.addedBy.name}</strong>
        {provenance.confidence !== null && <> · {percent(provenance.confidence)}</>}
      </p>}

      {engagement.nextAction && <p className="next">Next: {engagement.nextAction}</p>}
      {activity && <p className="small quiet">{new Date(activity.at).toLocaleDateString()} — {activity.title}</p>}

      {/* The run this person is on, and the one optional step hanging off its end. */}
      {flow.length > 0 && <>
        <StepFlow compact label={`Progress for ${person?.displayName ?? 'this engagement'}`}
          steps={journey(engagement)} extra={finalBubble(engagement)} />
        {finalStepOf(engagement) && <p className="small quiet step-caption">{stepCaption(engagement)}</p>}
      </>}

      {addingFinal === engagement.id && <form className="final-step-form" onSubmit={async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const data_ = new FormData(form);
        const title = String(data_.get('title') ?? '').trim();
        const dueAt = String(data_.get('dueAt') ?? '');
        if (!title) return;
        const body: Record<string, unknown> = {title, engagementId: engagement.id, status: 'OPEN'};
        if (engagement.personId) body.personId = engagement.personId;
        if (dueAt) body.dueAt = new Date(`${dueAt}T09:00`).toISOString();
        if (await writeFinalStep('tasks', 'POST', body, `final:${engagement.id}:${title}:${dueAt}`, 'Last step added.')) setAddingFinal(undefined);
      }}>
        <label className="field"><span className="field-label">Last step</span>
          <input name="title" required maxLength={2000} autoFocus placeholder="Send the intro deck" /></label>
        <label className="field"><span className="field-label">By when (optional)</span>
          <input name="dueAt" type="date" /></label>
        <div className="row-actions">
          <button className="small-button">Add step</button>
          <button type="button" className="secondary small-button" onClick={() => setAddingFinal(undefined)}>Cancel</button>
        </div>
      </form>}

      {/* One row of actions. Choosing a step outright is the stepper's job now,
          so the old duplicate stage picker is gone. */}
      <div className="card-actions">
        <div className="move" role="group" aria-label={`Move ${person?.displayName ?? 'this engagement'}`}>
          <button className="secondary" disabled={busy || column === 0}
            onClick={() => move(engagement, all[column - 1].id)}>
            ←<span className="sr-only"> Move {person?.displayName ?? 'engagement'} back to {all[column - 1]?.name}</span>
          </button>
          <button className="secondary" disabled={busy || column === all.length - 1}
            onClick={() => move(engagement, all[column + 1].id)}>
            →<span className="sr-only"> Move {person?.displayName ?? 'engagement'} forward to {all[column + 1]?.name}</span>
          </button>
        </div>
        {engagement.status !== 'CLOSED' && person && <button className="secondary small-button" onClick={()=>setInviting(engagement)}>Invite</button>}
      </div>
      {busy && <span role="status" className="small">Moving…</span>}
    </li>;
  };

  const board = (columns: Stage[], label: string) => <ol className="board" aria-label={label}>
    {columns.map((stage, column) => {
      const inStage = cards.filter(row => targetStageId(row) === stage.id);
      const help = guidanceFor(stage.name);
      return <li key={stage.id} className="stage">
        <h3><span className="step-number" aria-hidden="true">{column + 1}</span>{stage.name}
          <span className="count" aria-label={`${inStage.length} in this step`}>{inStage.length}</span></h3>
        {help && <p className="small quiet">{help.meaning}</p>}
        {stage.terminalOutcome && <p className="small">Ends the engagement as {stage.terminalOutcome}.</p>}
        {inStage.length === 0
          ? <p className="small quiet">Empty</p>
          : <ul className="cards">{inStage.map(engagement => card(engagement, column, columns))}</ul>}
      </li>;
    })}
  </ol>;

  const table = <table className="records pipeline-table">
    <caption className="small">Everyone in {pipeline?.name ?? 'this pipeline'}, with where they stand.</caption>
    <thead><tr>
      <th scope="col">Person</th><th scope="col">Role and company</th><th scope="col">Stage</th>
      <th scope="col">Found by</th><th scope="col">Next action</th><th scope="col">Last activity</th><th scope="col">Action</th>
    </tr></thead>
    <tbody>
      {cards.map(engagement => {
        const {person, organization, provenance, activity} = context(engagement);
        const stage = openStages.find(row => row.id === targetStageId(engagement));
        return <tr key={engagement.id}>
          <th scope="row">{engagement.personId
            ? <Link href={`/app/${workspaceId}/people/${engagement.personId}`}>{person?.displayName ?? 'Person unavailable'}</Link>
            : 'No person linked'}
            <span className="small quiet"> {engagement.objective}</span></th>
          <td>{[person?.title, organization?.name, person?.location].filter(Boolean).join(' · ') || '—'}</td>
          <td>
            <FormSelect id={`row-stage-${engagement.id}`} aria-label={`Stage for ${person?.displayName ?? 'this engagement'}`} value={stage?.id??engagement.stageId} disabled={moving === engagement.id}
              onValueChange={stageId => move(engagement, stageId)}
              options={openStages.map(option => ({value:option.id,label:option.name}))} />
            {!stage && <span className="small"> This engagement sits in a retired step.</span>}
          </td>
          <td>{provenance?.addedBy?.kind === 'agent'
            ? <>{provenance.addedBy.name}{provenance.confidence !== null ? ` · ${percent(provenance.confidence)}` : ''}</>
            : provenance?.addedBy ? provenance.addedBy.name : '—'}</td>
          <td>{engagement.nextAction || '—'}</td>
          <td>{activity ? `${new Date(activity.at).toLocaleDateString()} — ${activity.title}` : '—'}</td>
          <td>{person&&engagement.status!=='CLOSED'?<button className="secondary small-button" onClick={()=>setInviting(engagement)}>Send invite</button>:'—'}</td>
        </tr>;
      })}
    </tbody>
  </table>;

  return <>
    {inviting&&<OutreachComposer workspaceId={workspaceId} engagementId={inviting.id} person={inviting.personId?people.get(inviting.personId):undefined} initialPurpose={inviting.objective} onClose={()=>setInviting(undefined)} onSent={()=>{setNotice('Invitation sent.');data.events.reload();}}/>}
    <Section title="Pipeline" state={{rows: pipelines.rows, error: pipelines.error, reload: pipelines.reload}}>
      <div className="pipeline-head">
        <h2>{pipeline?.name ?? 'Coffee chats'}</h2>
        <div className="pipeline-actions">
          <div role="group" aria-label="How to show the pipeline" className="view-toggle">
            <button className={view === 'board' ? '' : 'secondary'} aria-pressed={view === 'board'} onClick={() => setView('board')}>Board</button>
            <button className={view === 'table' ? '' : 'secondary'} aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
          </div>
          <button onClick={() => { setAdding(true); setNotice(''); }}>Add an engagement</button>
        </div>
      </div>
      {pipeline && <p className="intro">{pipeline.purpose}</p>}
      {lifecycle && <p className="small quiet">
        Caffriend keeps these five steps consistent so accepted invitations can move a person to Meeting booked automatically.
      </p>}

      {/* The pipeline itself, drawn as the run it is. Each bubble carries how many people stand there. */}
      {flow.length > 0 && engagements.rows && <StepFlow label={`Steps in ${pipeline?.name ?? 'this pipeline'}`}
        steps={flow.map(stage => {
          const count = cards.filter(row => targetStageId(row) === stage.id).length;
          return {
            key: stage.id, label: stage.name, icon: iconFor(stage.name),
            sub: count === 1 ? '1 person' : `${count} people`,
            state: count > 0 ? 'done' : 'todo',
            hint: `${stage.name} — ${count === 1 ? '1 person' : `${count} people`}`,
          } as FlowStep;
        })} />}

      {notice && <p role="status" className="notice">{notice}</p>}
      {problem && <p role="alert">{problem}</p>}


      {adding && pipelineId && <div className="card">
        <h3>New engagement</h3>
        <EngagementForm workspaceId={workspaceId} people={data.people.rows ?? []} pipelines={live}
          stages={stages.rows ?? []} pipelineId={pipelineId}
          onCreated={() => { setAdding(false); setNotice('Engagement created.'); engagements.reload(); data.events.reload(); }}
          onCancel={() => setAdding(false)} />
      </div>}

      {stages.error && <p role="alert">Unable to load the steps of this pipeline. <button className="secondary" onClick={stages.reload}>Try again</button></p>}
      {!stages.rows && !stages.error && <p role="status">Loading steps…</p>}
      {stages.rows && openStages.length === 0 && <Empty>This pipeline has no steps. Contact support so booking automation can be restored safely.</Empty>}

      {/* What to do next, said plainly, instead of an empty board with no explanation. */}
      {nothingYet && openStages.length > 0 && <Empty>
        Nothing is in this pipeline yet. An <strong>engagement</strong> is one effort with one person — “get an introduction to the platform team”.{' '}
        <Link className="text-link" href={`/app/${workspaceId}/people`}>Add a person</Link>, then use <strong>Add an engagement</strong> above.
      </Empty>}

      {stages.rows && openStages.length > 0 && (
        engagements.error && !engagements.rows
          ? <p role="alert">{engagements.error.message} <button className="secondary" onClick={engagements.reload}>Try again</button></p>
          : !engagements.rows
            ? <p role="status">Loading engagements…</p>
            : view === 'table'
              ? (cards.length > 0 ? table : null)
              : <>
                  {board(flow, 'Active pipeline')}
                  {terminal.length > 0 && <details className="closed-stages">
                    <summary>Finished ({terminal.reduce((total, stage) => total + cards.filter(row => row.stageId === stage.id).length, 0)})</summary>
                    {board(terminal, 'Finished engagements')}
                  </details>}
                </>)}
      <More state={engagements} />
    </Section>

    {false && editingStages && pipelineId && <section className="card pipeline-editor">
      <header className="editor-heading">
        <div>
          <h2>Steps in {pipeline?.name}</h2>
          <p>Put the journey in the order your relationships actually follow.</p>
        </div>
        <button className="secondary" onClick={() => setEditingStages(false)}>Done</button>
      </header>
      <ol className="stage-editor-list">
        {(stages.rows ?? []).map((stage, index, all) => <li key={stage.id} className={`stage-editor-row${stage.archived ? ' archived' : ''}`}>
          <span className="stage-order" aria-hidden="true">{index + 1}</span>
          <form className="stage-name-form" onSubmit={event => { event.preventDefault();
            const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
            configure(`workspaces/${workspaceId}/pipelines/${pipelineId}/stages/${stage.id}`, 'PATCH', {name}, `stage-name:${stage.id}:${name}`, stages.reload);
          }}>
            <label className="sr-only" htmlFor={`stage-name-${stage.id}`}>Name of step {index + 1}</label>
            <input id={`stage-name-${stage.id}`} name="name" defaultValue={stage.name} required maxLength={200} />
            <button className="secondary">Save name<span className="sr-only"> for {stage.name}</span></button>
          </form>
          <div className="stage-actions" role="group" aria-label={`Actions for ${stage.name}`}>
            <button className="secondary icon-action" title="Move earlier" disabled={index === 0} onClick={() => {
              const order = all.map(row => row.id);
              [order[index - 1], order[index]] = [order[index], order[index - 1]];
              configure(`workspaces/${workspaceId}/pipelines/${pipelineId}/stages/reorder`, 'PUT', {stageIds: order}, `reorder:${order.join('.')}`, stages.reload);
            }}>↑<span className="sr-only"> Move earlier — {stage.name}</span></button>
            <button className="secondary icon-action" title="Move later" disabled={index === all.length - 1} onClick={() => {
              const order = all.map(row => row.id);
              [order[index], order[index + 1]] = [order[index + 1], order[index]];
              configure(`workspaces/${workspaceId}/pipelines/${pipelineId}/stages/reorder`, 'PUT', {stageIds: order}, `reorder:${order.join('.')}`, stages.reload);
            }}>↓<span className="sr-only"> Move later — {stage.name}</span></button>
            <button className="secondary retire-action" onClick={() => configure(`workspaces/${workspaceId}/pipelines/${pipelineId}/stages/${stage.id}`, 'PATCH', {archived: !stage.archived}, `stage-archive:${stage.id}:${!stage.archived}`, stages.reload)}>
              {stage.archived ? 'Restore' : 'Retire'}<span className="sr-only"> — {stage.name}</span>
            </button>
          </div>
        </li>)}
      </ol>
      <form className="add-stage-form" onSubmit={event => { event.preventDefault(); const form = event.currentTarget;
        const name = String(new FormData(form).get('name') ?? '').trim();
        configure(`workspaces/${workspaceId}/pipelines/${pipelineId}/stages`, 'POST', {name}, `stage-new:${name}`, () => { form.reset(); stages.reload(); });
      }}>
        <label className="field"><span className="field-label">Add a step</span><input name="name" placeholder="e.g. Proposal sent" required maxLength={200} /></label>
        <button>Add step</button>
      </form>

      <section className="pipeline-details" aria-labelledby="pipeline-details-heading">
      <h3 id="pipeline-details-heading">Pipeline details</h3>
      <form onSubmit={event => { event.preventDefault();
        const data = new FormData(event.currentTarget);
        const body = {name: String(data.get('name') ?? '').trim(), purpose: String(data.get('purpose') ?? '').trim()};
        configure(`workspaces/${workspaceId}/pipelines/${pipelineId}`, 'PATCH', body, `pipeline:${pipelineId}:${JSON.stringify(body)}`, pipelines.reload);
      }}>
        <div className="pipeline-detail-fields">
          <label className="field"><span className="field-label">Name</span><input name="name" defaultValue={pipeline?.name} required maxLength={200} /></label>
          <label className="field"><span className="field-label">Purpose</span><input name="purpose" defaultValue={pipeline?.purpose} required maxLength={2000} /></label>
        </div>
        <button className="secondary">Save details</button>
      </form>
      </section>
      <section className="archive-pipeline" aria-labelledby="archive-pipeline-heading">
        <div><h3 id="archive-pipeline-heading">Archive pipeline</h3><p>Hide this pipeline without deleting its history.</p></div>
        <button className="secondary danger" onClick={() => configure(`workspaces/${workspaceId}/pipelines/${pipelineId}`, 'PATCH', {archived: true}, `pipeline-archive:${pipelineId}`, () => { setSelected(undefined); setEditingStages(false); pipelines.reload(); })}>Archive {pipeline?.name}</button>
      </section>
    </section>}
  </>;
}
