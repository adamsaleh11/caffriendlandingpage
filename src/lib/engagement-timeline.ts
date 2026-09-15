import { actorLabels } from './contracts';
import type { TimelineEntry } from './timeline-entry';

/** One row of the server's engagement timeline, as the endpoint returns it. */
export type TimelineItem = {
  id: string;
  /** The server's activity kind. Only `MEETING_BOOKED` names the invitee. */
  kind: string;
  /** When it happened. The server's own name for this field, not `createdAt`. */
  occurredAt: string;
  /** The server's own wording for the row. Row titles are never assembled here. */
  summary: string;
  actorType: string;
  actorMemberId?: string | null;
  actorAgentId?: string | null;
  engagementId?: string | null;
};

export type MergeInput = {
  entries: TimelineEntry[];
  items: TimelineItem[];
  person?: { displayName: string } | null;
  /** Workspace agents, so agent work is never presented as a person's. */
  agents?: { id: string; name?: string | null }[];
};

/**
 * Timeline entries assembled from the server's timeline rows, merged with the
 * entries the page already has.
 */
/** The activity the server writes when an invitation is accepted and a meeting is booked. */
const acceptanceType = 'MEETING_BOOKED';

/**
 * A Guest invitee's acceptance is as real as an Account invitee's, but no
 * Connection follows from it, so the two are never collapsed into one label.
 */
const agentFor = (item: TimelineItem, agents: MergeInput['agents']): string | null =>
  item.actorAgentId ? (agents ?? []).find(row => row.id === item.actorAgentId)?.name || 'An agent' : null;

const actorFor = (item: TimelineItem, person: MergeInput['person']): string => {
  const generic = actorLabels[item.actorType] ?? item.actorType;
  // Only an acceptance names the invitee. Decline attribution is not recorded
  // reliably, so a decline keeps the generic word and never a `(guest)` claim.
  if (item.kind !== acceptanceType || !person) return generic;
  return item.actorType === 'GUEST' ? `${person.displayName} (guest)` : person.displayName;
};

export function mergeTimeline({entries, items, person, agents}: MergeInput): TimelineEntry[] {
  const fromItems = items.map((item): TimelineEntry => {
    const agentName = agentFor(item, agents);
    return {
      id: `timeline:${item.id}`,
      at: item.occurredAt,
      title: item.summary,
      actor: agentName ?? actorFor(item, person),
      byAgent: !!agentName,
      kind: 'change',
    };
  });
  return [...entries, ...fromItems].sort((a, b) => a.at.localeCompare(b.at));
}
