'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useList, useRows, type Loaded } from './common';
import {
  actorLabels, auditActions,
  type Agent, type Approval, type AuditEvent, type Conversation, type Engagement, type Meeting,
  type Note, type Organization, type Person, type Pipeline, type SourceArtifact, type SourceClaim,
  type Stage, type Task,
} from '@/lib/contracts';

/**
 * One load of everything the relationship views read.
 *
 * The Pipeline board and a person's page answer the same questions — who is this,
 * why are they here, what happened, what is next — from the same records, so they
 * share one loader rather than each assembling a different partial picture.
 *
 * Every list below is a real backend collection. Nothing is derived into a record
 * that the server does not have.
 */
export type WorkspaceData = {
  people: Loaded<Person>;
  organizations: Loaded<Organization>;
  engagements: Loaded<Engagement>;
  notes: Loaded<Note>;
  tasks: Loaded<Task>;
  meetings: Loaded<Meeting>;
  events: Loaded<AuditEvent>;
  claims: Loaded<SourceClaim>;
  artifacts: Loaded<SourceArtifact>;
  conversations: Loaded<Conversation>;
  agents: Loaded<Agent>;
  approvals: Loaded<Approval>;
};

/**
 * `pipelineId` narrows the engagement list server-side, which is the only filter
 * the backend list endpoint accepts besides `search`. Omit it for every screen
 * that must see a person's engagements across all pipelines.
 */
export function useWorkspaceData(workspaceId: string, pipelineId?: string): WorkspaceData {
  const crm = (resource: string) => `workspaces/${workspaceId}/crm/${resource}`;
  return {
    people: useList<Person>(crm('people')),
    organizations: useList<Organization>(crm('organizations')),
    engagements: useList<Engagement>(pipelineId ? `${crm('engagements')}?pipelineId=${pipelineId}` : crm('engagements')),
    notes: useList<Note>(crm('notes')),
    tasks: useList<Task>(crm('tasks')),
    meetings: useList<Meeting>(`workspaces/${workspaceId}/meetings`),
    events: useList<AuditEvent>(crm('audit-events')),
    claims: useList<SourceClaim>(crm('source-claims')),
    artifacts: useList<SourceArtifact>(crm('source-artifacts')),
    conversations: useList<Conversation>(crm('conversations')),
    agents: useList<Agent>(crm('agents')),
    approvals: useList<Approval>(crm('approvals')),
  };
}

/**
 * Stages for every pipeline in the workspace, keyed by pipeline id.
 *
 * A person may hold engagements in several pipelines at once, and each engagement's
 * position only means something against its own pipeline's stages. The stage list
 * is per-pipeline in the backend, so they are fetched per pipeline and merged here
 * rather than one list being reused for all of them.
 */
export function useAllStages(workspaceId: string, pipelines: Pipeline[] | undefined) {
  const [byPipeline, setByPipeline] = useState<Record<string, Stage[]>>();
  const [error, setError] = useState<ApiError>();
  const ids = (pipelines ?? []).map(row => row.id).join(',');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (pipelines === undefined) { setByPipeline(undefined); return; }
    const list = ids ? ids.split(',') : [];
    if (!list.length) { setByPipeline({}); return; }
    let live = true;
    setByPipeline(undefined); setError(undefined);
    Promise.all(list.map(id =>
      api<Stage[]>(`workspaces/${workspaceId}/pipelines/${id}/stages`).then(rows => [id, Array.isArray(rows) ? rows : []] as const)))
      .then(pairs => { if (live) setByPipeline(Object.fromEntries(pairs)); })
      .catch(problem => { if (live) setError(problem instanceof ApiError ? problem : new ApiError(503, 'Pipeline steps are unavailable right now.')); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the pipeline id list is the only input
  }, [workspaceId, ids, attempt, pipelines === undefined]);
  return { byPipeline, error, reload: () => setAttempt(value => value + 1) };
}

export function usePipelines(workspaceId: string, pipelineId?: string) {
  const pipelines = useRows<Pipeline>(`workspaces/${workspaceId}/pipelines`);
  const stages = useRows<Stage>(pipelineId ? `workspaces/${workspaceId}/pipelines/${pipelineId}/stages` : null);
  return { pipelines, stages };
}

/* -------------------------------------------------------------------------- */
/* Provenance: why a person is in the workspace at all.                        */
/* -------------------------------------------------------------------------- */

/**
 * How a person arrived, assembled only from records the backend actually keeps.
 *
 * - `addedBy` comes from the `people.created` audit event for this person, which
 *   carries `actorType` and `actorAgentId`. When the record was created by
 *   approving a proposal, the proposal's `requesterAgentId` names the agent that
 *   asked for it. Both are server facts; neither is guessed from the person row.
 * - `sourceCategory` is the person's own column.
 * - `reasons`, `citation` and `confidence` are the `source-claims` cited for this
 *   person. Absent claims mean absent reasons, not a fabricated one.
 */
export type Provenance = {
  addedBy: { kind: 'agent' | 'human' | 'system'; name: string } | null;
  viaApproval: boolean;
  sourceCategory: string;
  artifact?: SourceArtifact;
  claims: SourceClaim[];
  conversation?: Conversation;
  /** 0–1, from the highest-confidence cited claim. Null when nothing is cited. */
  confidence: number | null;
  addedAt: string | null;
};

export function provenanceFor(personId: string, data: WorkspaceData): Provenance {
  const created = (data.events.rows ?? []).find(
    event => event.targetId === personId && (event.action === 'people.created' || event.action === 'person.created'));
  const approval = created?.approvalId
    ? (data.approvals.rows ?? []).find(row => row.id === created.approvalId)
    : undefined;
  const agentId = created?.actorAgentId ?? approval?.requesterAgentId ?? null;
  const agent = agentId ? (data.agents.rows ?? []).find(row => row.id === agentId) : undefined;

  const addedBy: Provenance['addedBy'] = agentId
    ? { kind: 'agent', name: agent?.name || 'An agent' }
    : created
      ? { kind: created.actorType === 'SYSTEM' ? 'system' : 'human', name: actorLabels[created.actorType] ?? created.actorType }
      : null;

  const claims = (data.claims.rows ?? []).filter(claim => claim.personId === personId);
  const artifact = claims.length ? (data.artifacts.rows ?? []).find(row => row.id === claims[0].artifactId) : undefined;
  const conversation = (data.conversations.rows ?? []).find(row => claims.some(claim => claim.conversationId === row.id));
  const person = (data.people.rows ?? []).find(row => row.id === personId);

  return {
    addedBy,
    viaApproval: !!created?.approvalId,
    sourceCategory: person?.sourceCategory ?? 'Not recorded',
    artifact,
    claims,
    conversation,
    confidence: claims.length ? Math.max(...claims.map(claim => claim.confidence)) : null,
    addedAt: created?.createdAt ?? person?.createdAt ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Timeline: one chronological history of a relationship.                      */
/* -------------------------------------------------------------------------- */

export type TimelineEntry = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  /** Who did it, when the record says. Agent work is never presented as the user's. */
  actor: string;
  byAgent: boolean;
  kind: 'change' | 'note' | 'task' | 'meeting';
};

/**
 * Every recorded thing that happened to this person, newest last.
 *
 * Audit events give the changes; notes, tasks and meetings give the substance.
 * They are merged, not invented: an entry exists only because a record exists.
 */
export function timelineFor(
  personId: string,
  engagementIds: Set<string>,
  data: WorkspaceData,
): TimelineEntry[] {
  const relevant = (row: { personId?: string | null; engagementId?: string | null }) =>
    row.personId === personId || (!!row.engagementId && engagementIds.has(row.engagementId));

  const entries: TimelineEntry[] = [];

  for (const event of data.events.rows ?? []) {
    const mine = event.targetId === personId || engagementIds.has(event.targetId);
    if (!mine) continue;
    const agentName = event.actorAgentId
      ? (data.agents.rows ?? []).find(row => row.id === event.actorAgentId)?.name || 'An agent'
      : null;
    entries.push({
      id: `event:${event.id}`,
      at: event.createdAt,
      title: auditActions[event.action] ?? event.action,
      detail: event.approvalId ? 'Applied by approving a proposal.' : undefined,
      actor: agentName ?? actorLabels[event.actorType] ?? event.actorType,
      byAgent: !!agentName,
      kind: 'change',
    });
  }
  for (const note of data.notes.rows ?? []) {
    if (!relevant(note)) continue;
    entries.push({ id: `note:${note.id}`, at: note.createdAt, title: 'Note', detail: note.body, actor: 'Note', byAgent: false, kind: 'note' });
  }
  for (const task of data.tasks.rows ?? []) {
    if (!relevant(task)) continue;
    entries.push({
      id: `task:${task.id}`, at: task.createdAt, title: `Follow-up: ${task.title}`,
      detail: [task.status, task.dueAt ? `due ${new Date(task.dueAt).toLocaleDateString()}` : null].filter(Boolean).join(' · '),
      actor: 'Task', byAgent: false, kind: 'task',
    });
  }
  for (const meeting of data.meetings.rows ?? []) {
    if (!meeting.engagementId || !engagementIds.has(meeting.engagementId)) continue;
    entries.push({
      id: `meeting:${meeting.id}`, at: meeting.startsAt, title: `Meeting: ${meeting.purpose}`,
      detail: `${new Date(meeting.startsAt).toLocaleString()} (${meeting.timezone})`,
      actor: 'Meeting', byAgent: false, kind: 'meeting',
    });
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

/** The most recent recorded activity, or null when nothing has happened yet. */
export function lastActivity(entries: TimelineEntry[]): TimelineEntry | null {
  return entries.length ? entries[entries.length - 1] : null;
}

/** Groups a timeline by calendar day, so a long history reads as dated blocks. */
export function useTimelineDays(entries: TimelineEntry[]) {
  return useMemo(() => {
    const days = new Map<string, TimelineEntry[]>();
    for (const entry of entries) {
      const day = new Date(entry.at).toDateString();
      days.set(day, [...(days.get(day) ?? []), entry]);
    }
    return [...days.entries()];
  }, [entries]);
}
