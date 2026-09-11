import { crmResources, type CrmResource } from './contracts';

/**
 * The fields this boundary is willing to disclose, per resource.
 *
 * The backend already projects, but it owns columns this product must not render
 * (`linkedUserId` on a person is the clearest example: opt-in Caffriend network
 * identity, not workspace-entered data). Re-projecting here means a future
 * backend column is withheld by default instead of leaking the day it ships.
 */
const common = ['id', 'workspaceId', 'createdAt', 'updatedAt'];
const archivable = [...common, 'archivedAt'];

const fields: Record<CrmResource, string[]> = {
  people: [...archivable, 'displayName', 'title', 'location', 'email', 'phone', 'sourceCategory', 'organizationId'],
  organizations: [...archivable, 'name', 'domain'],
  engagements: [...archivable, 'personId', 'organizationId', 'pipelineId', 'stageId', 'ownerId', 'status', 'objective', 'nextAction'],
  notes: [...archivable, 'body', 'personId', 'engagementId', 'sourceConversationId'],
  tasks: [...archivable, 'title', 'personId', 'engagementId', 'assigneeId', 'dueAt', 'status'],
  pipelines: ['id', 'name', 'purpose', 'archived'],
  stages: ['id', 'pipelineId', 'name', 'position', 'terminalOutcome', 'archived'],
  approvals: [...common, 'action', 'payload', 'rightsState', 'status', 'reason', 'requesterMemberId', 'requesterAgentId', 'reviewerId'],
  'audit-events': ['id', 'workspaceId', 'createdAt', 'actorType', 'actorMemberId', 'actorAgentId', 'action', 'targetType', 'targetId', 'approvalId'],
  'source-artifacts': [...common, 'filename', 'mediaType', 'sizeBytes', 'sha256', 'sourceOwner', 'publisher', 'acquisitionMethod', 'sourceUrl', 'licenseTermsRef', 'permittedUseBasis', 'restrictions', 'retentionStatus', 'reviewStatus', 'reviewAt', 'rightsState', 'permittedUses'],
  'source-claims': [...common, 'artifactId', 'conversationId', 'personId', 'engagementId', 'targetField', 'extractedValue', 'locator', 'confidence', 'rightsState', 'permittedUses'],
  conversations: [...common, 'provider', 'providerConversationId', 'title', 'durableUrl'],
  agents: [...common, 'name', 'status'],
  meetings: [...common, 'purpose', 'startsAt', 'endsAt', 'timezone', 'status', 'provider', 'joinUrl', 'physicalLocation', 'agenda', 'engagementId', 'organizerId', 'connectionId', 'errorCode'],
};

export const isResource = (value: string): value is CrmResource => (crmResources as readonly string[]).includes(value);

export function project(resource: CrmResource, row: unknown): Record<string, unknown> {
  const source = (row ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of fields[resource]) if (field in source) out[field] = source[field];
  return out;
}

export function projectPage(resource: CrmResource, body: unknown) {
  const page = (body ?? {}) as { items?: unknown; nextCursor?: unknown };
  return {
    items: Array.isArray(page.items) ? page.items.map(row => project(resource, row)) : [],
    nextCursor: typeof page.nextCursor === 'string' ? page.nextCursor : null,
  };
}

/**
 * A source chat is linked only when the provider supplied a durable https URL.
 * Anything else renders as unavailable rather than as a guessed link.
 */
export function safeDurableUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}
