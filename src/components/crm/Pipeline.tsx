'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type { Engagement, Pipeline as PipelineRecord, Stage } from '@/lib/contracts';
import { canonicalPipeline, guidanceFor, isCanonical } from '@/lib/lifecycle';
import { useKeys, useRows, Section, Empty, More } from './common';
import { lastActivity, provenanceFor, timelineFor, useWorkspaceData } from './workspace-data';
import EngagementForm from './EngagementForm';

/**
 * Starting points for a new workspace.
 *
 * Both write the same lifecycle stages, because the lifecycle does not change with
 * the goal: a coffee chat that becomes an interview and a conversation that becomes
 * client work run through the same steps. Only the pipeline's stated purpose
 * differs. Stages remain fully editable afterwards — these are real rows in the
 * workspace, not a fixed server enum.
 */
const templates = [
  { name: 'Coffee chats', purpose: 'Meet people at companies I want to work at, and turn those chats into interviews.', stages: canonicalPipeline.stages },
  { name: 'Client conversations', purpose: 'Take people I want to work with from a first conversation to real work together.', stages: canonicalPipeline.stages },
];

const percent = (value: number) => `${Math.round(value * 100)}%`;

export default function Pipeline({workspaceId}:{workspaceId:string}) {
  const [selected, setSelected] = useState<string>();
  const [view, setView] = useState<'board'|'table'>('board');
  const [editingStages, setEditingStages] = useState(false);
  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [moving, setMoving] = useState<string>();
  const [building, setBuilding] = useState('');
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

  const openStages = (stages.rows ?? []).filter(stage => !stage.archived);
  /** Terminal stages are real stages, kept out of the active run so it stays readable. */
  const flow = openStages.filter(stage => !stage.terminalOutcome);
  const terminal = openStages.filter(stage => !!stage.terminalOutcome);
  const lifecycle = isCanonical(openStages.map(stage => stage.name));

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

  async function configure(path: string, method: string, body: unknown, key: string, after: () => void) {
    setProblem(''); setNotice('');
    try { await api(path, {method, body: JSON.stringify(body), headers:{'X-Idempotency-Key': keyFor(key)}}); after(); }
    catch (error) { setProblem(error instanceof ApiError ? error.message : 'That change did not save.'); }
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
      setSelected(created.id); setCreatingPipeline(false);
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
      Pick a starting point; every step is yours to rename, reorder or retire afterwards.
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
      <li>
        <h2>Start from scratch</h2>
        <p>Name your own pipeline and add each step yourself.</p>
        <NewPipeline workspaceId={workspaceId} onCreated={id => { setSelected(id); pipelines.reload(); }} keyFor={keyFor} />
      </li>
    </ul>
  </section>;

  const cards = engagements.rows ?? [];
  const nothingYet = !!engagements.rows && cards.length === 0;

  const card = (engagement: Engagement, column: number, all: Stage[]) => {
    const {person, organization, provenance, activity} = context(engagement);
    const busy = moving === engagement.id;
    return <li key={engagement.id} className="engagement">
      {/* The person leads: that is who you are actually tracking. */}
      <p className="who">{engagement.personId
        ? <Link href={`/app/${workspaceId}/people/${engagement.personId}`}>{person?.displayName ?? 'Person unavailable'}</Link>
        : 'No person linked'}</p>
      {person && <p className="small role">{[person.title, organization?.name, person.location].filter(Boolean).join(' · ') || 'No role recorded'}</p>}
      <p className="objective">{engagement.objective}</p>

      {/* Why this person is here at all, so nobody meets an unexplained name. */}
      {provenance && <p className="small source">
        {provenance.addedBy?.kind === 'agent'
          ? <>Found by <strong>{provenance.addedBy.name}</strong></>
          : provenance.addedBy
            ? <>Added by {provenance.addedBy.name.toLowerCase()}</>
            : <>Added to this workspace</>}
        {' · '}{provenance.sourceCategory}
        {provenance.confidence !== null && <> · confidence {percent(provenance.confidence)}</>}
      </p>}
      {provenance?.claims[0] && <p className="small why">Why: {String(provenance.claims[0].extractedValue)}</p>}

      <p className="next">{engagement.nextAction ? <>Next: {engagement.nextAction}</> : <span className="quiet">No next action recorded</span>}</p>
      <p className="small quiet">
        {activity ? `Last activity ${new Date(activity.at).toLocaleDateString()} — ${activity.title}` : 'No activity yet'}
        {' · '}{engagement.ownerId ? 'Owned' : 'No owner'}
      </p>

      <div className="move" role="group" aria-label={`Move ${person?.displayName ?? 'this engagement'}`}>
        <button className="secondary" disabled={busy || column === 0}
          onClick={() => move(engagement, all[column - 1].id)}>
          ←<span className="sr-only"> Move {person?.displayName ?? 'engagement'} back to {all[column - 1]?.name}</span>
        </button>
        <button className="secondary" disabled={busy || column === all.length - 1}
          onClick={() => move(engagement, all[column + 1].id)}>
          →<span className="sr-only"> Move {person?.displayName ?? 'engagement'} forward to {all[column + 1]?.name}</span>
        </button>
        {/* Jumping several steps at once, for anyone who wants it. */}
        <label className="sr-only" htmlFor={`stage-${engagement.id}`}>Stage for {person?.displayName ?? 'this engagement'}</label>
        <select id={`stage-${engagement.id}`} value={engagement.stageId} disabled={busy}
          onChange={event => move(engagement, event.target.value)}>
          {openStages.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </div>
      {busy && <span role="status" className="small">Moving…</span>}
    </li>;
  };

  const board = (columns: Stage[], label: string) => <ol className="board" aria-label={label}>
    {columns.map((stage, column) => {
      const inStage = cards.filter(row => row.stageId === stage.id);
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
      <th scope="col">Found by</th><th scope="col">Next action</th><th scope="col">Last activity</th>
    </tr></thead>
    <tbody>
      {cards.map(engagement => {
        const {person, organization, provenance, activity} = context(engagement);
        const stage = openStages.find(row => row.id === engagement.stageId);
        return <tr key={engagement.id}>
          <th scope="row">{engagement.personId
            ? <Link href={`/app/${workspaceId}/people/${engagement.personId}`}>{person?.displayName ?? 'Person unavailable'}</Link>
            : 'No person linked'}
            <span className="small quiet"> {engagement.objective}</span></th>
          <td>{[person?.title, organization?.name, person?.location].filter(Boolean).join(' · ') || '—'}</td>
          <td>
            <label className="sr-only" htmlFor={`row-stage-${engagement.id}`}>Stage for {person?.displayName ?? 'this engagement'}</label>
            <select id={`row-stage-${engagement.id}`} value={engagement.stageId} disabled={moving === engagement.id}
              onChange={event => move(engagement, event.target.value)}>
              {openStages.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            {!stage && <span className="small"> This engagement sits in a retired step.</span>}
          </td>
          <td>{provenance?.addedBy?.kind === 'agent'
            ? <>{provenance.addedBy.name}{provenance.confidence !== null ? ` · ${percent(provenance.confidence)}` : ''}</>
            : provenance?.addedBy ? provenance.addedBy.name : '—'}</td>
          <td>{engagement.nextAction || '—'}</td>
          <td>{activity ? `${new Date(activity.at).toLocaleDateString()} — ${activity.title}` : '—'}</td>
        </tr>;
      })}
    </tbody>
  </table>;

  return <>
    <Section title="Pipeline" state={{rows: pipelines.rows, error: pipelines.error, reload: pipelines.reload}}>
      <div className="pipeline-head">
        <label className="pipeline-picker">Pipeline
          <select value={pipelineId ?? ''} onChange={event => setSelected(event.target.value)}>
            {live.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </label>
        <div role="group" aria-label="How to show the pipeline" className="view-toggle">
          <button className={view === 'board' ? '' : 'secondary'} aria-pressed={view === 'board'} onClick={() => setView('board')}>Board</button>
          <button className={view === 'table' ? '' : 'secondary'} aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
        </div>
        <button onClick={() => { setAdding(true); setNotice(''); }}>Add an engagement</button>
        <button className="secondary" aria-expanded={editingStages} onClick={() => setEditingStages(!editingStages)}>
          {editingStages ? 'Done editing steps' : 'Edit steps'}
        </button>
        <button className="secondary" onClick={() => setCreatingPipeline(!creatingPipeline)}>New pipeline</button>
      </div>
      {pipeline && <p className="intro">{pipeline.purpose}</p>}
      {lifecycle && <p className="small quiet">
        This pipeline follows the Caffriend lifecycle: a prospect is qualified, contacted, engaged, scheduled, met, followed up, and kept as a relationship.
      </p>}

      {notice && <p role="status" className="notice">{notice}</p>}
      {problem && <p role="alert">{problem}</p>}

      {creatingPipeline && <div className="card">
        <h3>New pipeline</h3>
        <NewPipeline workspaceId={workspaceId} onCreated={id => { setSelected(id); setCreatingPipeline(false); pipelines.reload(); }} keyFor={keyFor} />
      </div>}

      {adding && pipelineId && <div className="card">
        <h3>New engagement</h3>
        <EngagementForm workspaceId={workspaceId} people={data.people.rows ?? []} pipelines={live}
          stages={stages.rows ?? []} pipelineId={pipelineId}
          onCreated={() => { setAdding(false); setNotice('Engagement created.'); engagements.reload(); data.events.reload(); }}
          onCancel={() => setAdding(false)} />
      </div>}

      {stages.error && <p role="alert">Unable to load the steps of this pipeline. <button className="secondary" onClick={stages.reload}>Try again</button></p>}
      {!stages.rows && !stages.error && <p role="status">Loading steps…</p>}
      {stages.rows && openStages.length === 0 && <Empty>This pipeline has no steps yet. Use <strong>Edit steps</strong> to add the first one.</Empty>}

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

    {editingStages && pipelineId && <section className="card">
      <h2>Steps in {pipeline?.name}</h2>
      <p>Rename a step, change its order, or retire one you no longer use. Engagements already in a retired step stay where they are.</p>
      <ol className="steps">
        {(stages.rows ?? []).map((stage, index, all) => <li key={stage.id}>
          <form className="inline" onSubmit={event => { event.preventDefault();
            const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
            configure(`workspaces/${workspaceId}/pipelines/${pipelineId}/stages/${stage.id}`, 'PATCH', {name}, `stage-name:${stage.id}:${name}`, stages.reload);
          }}>
            <label>Step {index + 1}<input name="name" defaultValue={stage.name} required maxLength={200} /></label>
            <button className="secondary">Rename</button>
          </form>
          <button className="secondary" disabled={index === 0} onClick={() => {
            const order = all.map(row => row.id);
            [order[index - 1], order[index]] = [order[index], order[index - 1]];
            configure(`workspaces/${workspaceId}/pipelines/${pipelineId}/stages/reorder`, 'PUT', {stageIds: order}, `reorder:${order.join('.')}`, stages.reload);
          }}>Move earlier<span className="sr-only"> — {stage.name}</span></button>
          <button className="secondary" disabled={index === all.length - 1} onClick={() => {
            const order = all.map(row => row.id);
            [order[index], order[index + 1]] = [order[index + 1], order[index]];
            configure(`workspaces/${workspaceId}/pipelines/${pipelineId}/stages/reorder`, 'PUT', {stageIds: order}, `reorder:${order.join('.')}`, stages.reload);
          }}>Move later<span className="sr-only"> — {stage.name}</span></button>
          <button className="secondary" onClick={() => configure(`workspaces/${workspaceId}/pipelines/${pipelineId}/stages/${stage.id}`, 'PATCH', {archived: !stage.archived}, `stage-archive:${stage.id}:${!stage.archived}`, stages.reload)}>
            {stage.archived ? 'Restore' : 'Retire'}<span className="sr-only"> — {stage.name}</span>
          </button>
        </li>)}
      </ol>
      <form onSubmit={event => { event.preventDefault(); const form = event.currentTarget;
        const name = String(new FormData(form).get('name') ?? '').trim();
        configure(`workspaces/${workspaceId}/pipelines/${pipelineId}/stages`, 'POST', {name}, `stage-new:${name}`, () => { form.reset(); stages.reload(); });
      }}>
        <label>Add a step<input name="name" required maxLength={200} /></label>
        <button>Add step</button>
      </form>

      <h3>This pipeline</h3>
      <form className="inline" onSubmit={event => { event.preventDefault();
        const data = new FormData(event.currentTarget);
        const body = {name: String(data.get('name') ?? '').trim(), purpose: String(data.get('purpose') ?? '').trim()};
        configure(`workspaces/${workspaceId}/pipelines/${pipelineId}`, 'PATCH', body, `pipeline:${pipelineId}:${JSON.stringify(body)}`, pipelines.reload);
      }}>
        <label>Name<input name="name" defaultValue={pipeline?.name} required maxLength={200} /></label>
        <label>What is it for?<input name="purpose" defaultValue={pipeline?.purpose} required maxLength={2000} /></label>
        <button className="secondary">Save</button>
      </form>
      <button className="secondary" onClick={() => configure(`workspaces/${workspaceId}/pipelines/${pipelineId}`, 'PATCH', {archived: true}, `pipeline-archive:${pipelineId}`, () => { setSelected(undefined); setEditingStages(false); pipelines.reload(); })}>Archive this pipeline</button>
    </section>}
  </>;
}

function NewPipeline({workspaceId, onCreated, keyFor}:{workspaceId:string; onCreated:(id:string)=>void; keyFor:(id:string)=>string}) {
  const [problem, setProblem] = useState('');
  const [pending, setPending] = useState(false);
  return <form onSubmit={async event => { event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = {name: String(data.get('name') ?? '').trim(), purpose: String(data.get('purpose') ?? '').trim()};
    setPending(true); setProblem('');
    try {
      const created = await api<PipelineRecord>(`workspaces/${workspaceId}/pipelines`, {method:'POST', body: JSON.stringify(body), headers:{'X-Idempotency-Key': keyFor(`pipeline-new:${JSON.stringify(body)}`)}});
      onCreated(created.id);
    } catch (error) { setProblem(error instanceof ApiError ? error.message : 'That pipeline was not created.'); }
    finally { setPending(false); }
  }}>
    <label>Pipeline name<input name="name" required maxLength={200} /></label>
    <label>What is it for?<input name="purpose" required maxLength={2000} /></label>
    {problem && <p role="alert">{problem}</p>}
    <button disabled={pending}>{pending ? 'Creating…' : 'Create pipeline'}</button>
  </form>;
}
