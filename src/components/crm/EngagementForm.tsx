'use client';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Engagement, Person, Pipeline, Stage } from '@/lib/contracts';
import { useKeys } from './common';
import {FormSelect} from '@/components/ui/form-select';

/**
 * The backend stores `status` as free text, so these are the workspace's working
 * vocabulary rather than a server enum. Anything here is accepted as typed.
 */
const statuses = ['OPEN', 'ON_HOLD', 'CLOSED'];

/**
 * Creating an engagement: the effort you are tracking with a person.
 *
 * A person can carry several at once — a referral route and a client lead, say —
 * each sitting in its own pipeline at its own stage. That is why this is separate
 * from creating the person.
 */
export default function EngagementForm({
  workspaceId, people, pipelines, stages, personId, pipelineId, onCreated, onCancel,
}:{
  workspaceId: string;
  people: Person[];
  pipelines: Pipeline[];
  stages: Stage[];
  /** Fixed when started from a person's page. */
  personId?: string;
  /** Fixed when started from a pipeline board. */
  pipelineId?: string;
  onCreated: (engagement: Engagement) => void;
  onCancel: () => void;
}) {
  const [pipeline, setPipeline] = useState(pipelineId ?? pipelines[0]?.id ?? '');
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState('');
  const keyFor = useKeys();

  // Stages belong to a pipeline, so the choice narrows as soon as one is picked.
  const options = stages.filter(stage => stage.pipelineId === pipeline && !stage.archived);

  async function submit(form: FormData) {
    const body: Record<string, unknown> = {
      pipelineId: pipeline,
      stageId: String(form.get('stageId') ?? ''),
      status: String(form.get('status') ?? 'OPEN'),
      objective: String(form.get('objective') ?? '').trim(),
    };
    const person = personId ?? String(form.get('personId') ?? '');
    if (person) body.personId = person;
    const nextAction = String(form.get('nextAction') ?? '').trim();
    if (nextAction) body.nextAction = nextAction;
    if (!body.stageId) { setProblem('Choose the stage this engagement starts in.'); return; }

    setPending(true); setProblem('');
    try {
      const created = await api<Engagement>(`workspaces/${workspaceId}/crm/engagements`, {
        method:'POST', body: JSON.stringify(body),
        headers:{'X-Idempotency-Key': keyFor(`engagement:${JSON.stringify(body)}`)},
      });
      onCreated(created);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That engagement was not created.');
    } finally { setPending(false); }
  }

  if (pipelines.length === 0) return <p role="note">
    You need a pipeline before you can track an engagement. Create one on the Pipeline screen first.
  </p>;

  return <form onSubmit={event => { event.preventDefault(); submit(new FormData(event.currentTarget)); }}>
    <p>An engagement is one effort with one person — “get an introduction at Acme”. The same person can have more than one.</p>

    {!personId && <div className="field">
      <span className="field-label">Person</span>
      <FormSelect name="personId" aria-label="Person" options={[{value:'',label:'No person yet'},...people.map(person => ({value:person.id,label:person.displayName}))]} />
    </div>}

    <label>What are you trying to achieve?
      <input name="objective" required maxLength={2000} autoFocus placeholder="Get an introduction to the platform team" />
    </label>

    {!pipelineId && <div className="field">
      <span className="field-label">Pipeline</span>
      <FormSelect aria-label="Pipeline" value={pipeline} onValueChange={setPipeline} options={pipelines.filter(row => !row.archived).map(row => ({value:row.id,label:row.name}))} />
    </div>}

    <div className="field">
      <span className="field-label">Starting stage</span>
      <FormSelect key={options[0]?.id ?? "none"} name="stageId" required aria-label="Starting stage" defaultValue={options[0]?.id ?? ''} options={options.map(stage => ({value:stage.id,label:stage.name}))} />
    </div>
    {options.length === 0 && <p role="alert">This pipeline has no stages yet. Add one before starting an engagement.</p>}

    <div className="field">
      <span className="field-label">Status</span>
      <FormSelect name="status" aria-label="Status" defaultValue="OPEN" options={statuses.map(status => ({value:status,label:status.replace('_', ' ').toLowerCase()}))} />
    </div>

    <label>Next action<input name="nextAction" maxLength={2000} placeholder="Send a short intro message" /></label>

    {problem && <p role="alert">{problem}</p>}
    <button disabled={pending || options.length === 0}>{pending ? 'Creating…' : 'Create engagement'}</button>
    <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
  </form>;
}
