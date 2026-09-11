export type Workspace = { id: string; name: string };
export type User = { id: string; name: string };
/**
 * Workspace navigation, in the order it is shown.
 *
 * Pipeline leads because it answers the question the CRM exists for — what is
 * happening with the people I am actively pursuing. People, by contrast, is the
 * roster: everyone in the workspace, whether or not anything is in flight.
 */
export const sections = ['pipeline', 'people', 'inbox', 'calendar', 'organizations', 'agents', 'history', 'settings'] as const;
export type Section = typeof sections[number];
/** The default landing section: the last-used workspace opens on its pipeline. */
export const homeSection: Section = 'pipeline';
export const sectionNames: Record<Section, string> = {
  pipeline: 'Pipeline',
  people: 'People',
  inbox: 'Inbox',
  calendar: 'Meetings',
  organizations: 'Organizations',
  agents: 'Agents',
  history: 'Activity',
  settings: 'Settings',
};
/** One glyph per section, in `sections` order. */
export const sectionIcons: Record<Section, string> = {
  pipeline: '\u25A4', people: '\u25CE', inbox: '\u25A3', calendar: '\u25F7',
  organizations: '\u25A5', agents: '\u2733', history: '\u25A6', settings: '\u2699',
};
/**
 * The engagement `status` vocabulary. The backend column is free text
 * (`VarChar(50)`), so this is the workspace's working set, not a server enum:
 * anything already stored renders as it was stored.
 */
export const engagementStatuses = ['OPEN', 'ON_HOLD', 'CLOSED'] as const;
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** The consumer surface: the same five screens the native app shows, rendered wide. */
export const appScreens = ['home', 'connections', 'calls', 'leaderboard', 'profile'] as const;
export type AppScreen = typeof appScreens[number];
export const appScreenNames: Record<AppScreen, string> = {
  home: 'Home', connections: 'Connections', calls: 'Upcoming calls', leaderboard: 'Leaderboard', profile: 'Profile',
};

export function safeReturn(value: unknown): string {
  if (typeof value !== 'string') return '/app';
  if (value === '/app' || value === '/app/workspaces/new') return value;
  if ((appScreens as readonly string[]).includes(value.replace(/^\//, ''))) return value;
  const nested = value.match(/^\/app\/([^/]+)\/(meetings|people)\/([^/]+)$/);
  if (nested && uuidPattern.test(nested[1]) && uuidPattern.test(nested[3])) return value;
  const match = value.match(/^\/app\/([^/]+)\/([^/]+)$/);
  return match && uuidPattern.test(match[1]) && sections.includes(match[2] as Section) ? value : '/app';
}

export const providers = ['GOOGLE', 'MICROSOFT'] as const;
export type Provider = typeof providers[number];
export const providerNames: Record<Provider, string> = { GOOGLE: 'Google Calendar', MICROSOFT: 'Outlook Calendar' };
export type ProviderStatus = { configured: boolean; errorCode?: string | null };
export type CalendarConnection = {
  id: string;
  provider: Provider;
  status: 'SELECT_CALENDAR' | 'CONNECTED' | 'ERROR' | 'DISCONNECTED';
  accountIdentifier?: string | null;
  calendarId?: string | null;
  calendarName?: string | null;
  // Required additive backend projection. Absent until that follow-up ships.
  scopes?: string[] | null;
  errorCode?: string | null;
};
export type CalendarOption = { id: string; name?: string | null; writable?: boolean; /** Whether this calendar can create a Meet or Teams conference. */ supportsConference?: boolean };
export type ConsentDetails = {
  // `client` is the required additive backend follow-up; Allow fails closed while it is absent.
  client?: { id: string; name: string } | null;
  scopes: string[];
  warnings?: string[] | null;
  workspaces: Workspace[];
  offlineRequested?: boolean;
};
export const scopeExplanations: Record<string, string> = {
  'notes:write': 'Add notes to your workspace. Applied immediately.',
  'tasks:write': 'Create tasks in your workspace. Applied immediately.',
  'people:read': 'Read the people in your workspace.',
  'meetings:read': 'Read your workspace meetings.',
  'proposals:write': 'Suggest changes as proposals. Nothing is applied until you approve it.',
  offline_access: 'Keep access when you are not using the application.',
};
export const immediateScopes = ['notes:write', 'tasks:write'];

export const meetingStatuses = ['LOCAL','PENDING','CONFIRMED','FAILED','CANCEL_PENDING','CANCEL_FAILED','CANCELLED'] as const;
export type MeetingStatus = typeof meetingStatuses[number];
/** Exactly the backend's `meetings` projection. Attendees and the provider event id are not in it. */
export type Meeting = {
  id: string;
  purpose: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: MeetingStatus;
  provider?: Provider | null;
  joinUrl?: string | null;
  physicalLocation?: string | null;
  agenda?: string | null;
  errorCode?: string | null;
  /** Present on the CRM meetings list, which links a meeting to its engagement. */
  engagementId?: string | null;
};
export const statusLabels: Record<MeetingStatus, string> = {
  LOCAL: 'Not yet sent to a calendar',
  PENDING: 'Sending the calendar invitation',
  CONFIRMED: 'Confirmed',
  FAILED: 'The calendar invitation failed',
  CANCEL_PENDING: 'Cancelling',
  CANCEL_FAILED: 'Cancellation failed',
  CANCELLED: 'Cancelled',
};
/** A meeting is joinable only while the server says it is scheduled. */
export const joinable = (status: MeetingStatus) => status === 'CONFIRMED' || status === 'LOCAL';
export type AuditEvent = {
  id: string;
  createdAt: string;
  action: string;
  actorType: string;
  /** Set when an agent acted. This is how the UI tells agent work from human work. */
  actorAgentId?: string | null;
  actorMemberId?: string | null;
  /** Set when the action was applied by approving a proposal. */
  approvalId?: string | null;
  targetType: string;
  targetId: string;
};

/* ---------------------------------------------------------------------------
 * CRM records.
 * Every field below is taken from `crm.records.ts` in Caffriend-backend.
 * Nothing here is speculative: a field absent from that registry is absent here.
 * ------------------------------------------------------------------------- */

export const crmResources = ['people','organizations','engagements','notes','tasks','pipelines','stages','approvals','audit-events','source-artifacts','source-claims','conversations','agents','meetings'] as const;
export type CrmResource = typeof crmResources[number];

/** Resources the backend allows a human member to write through the generic path. */
export const writableResources = ['people','organizations','engagements','notes','tasks','source-artifacts','source-claims','conversations'] as const;
/** Resources the backend soft-archives instead of deleting. */
export const archivableResources = ['people','organizations','engagements','notes','tasks'] as const;

export type Page<T> = { items: T[]; nextCursor: string | null };

type Record_ = { id: string; workspaceId: string; createdAt: string; updatedAt: string };
type Archivable = { archivedAt?: string | null };

export type Person = Record_ & Archivable & {
  displayName: string;
  title?: string | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  sourceCategory: string;
  organizationId?: string | null;
};
export type Organization = Record_ & Archivable & { name: string; domain?: string | null };
export type Engagement = Record_ & Archivable & {
  personId?: string | null;
  organizationId?: string | null;
  pipelineId: string;
  stageId: string;
  ownerId?: string | null;
  status: string;
  objective: string;
  nextAction?: string | null;
};
export type Note = Record_ & Archivable & { body: string; personId?: string | null; engagementId?: string | null; sourceConversationId?: string | null };
export type Task = Record_ & Archivable & { title: string; personId?: string | null; engagementId?: string | null; assigneeId?: string | null; dueAt?: string | null; status: string };
export type Pipeline = { id: string; name: string; purpose: string; archived: boolean };
export type Stage = { id: string; pipelineId: string; name: string; position: number; terminalOutcome?: string | null; archived: boolean };

export const rightsStates = ['PERMITTED','RESTRICTED','UNKNOWN','PROHIBITED'] as const;
export type RightsState = typeof rightsStates[number];
export const permittedUses = ['OUTREACH','EXPORT','RETENTION','REPUBLICATION'] as const;
export type PermittedUse = typeof permittedUses[number];

/** How each rights state is explained to a reviewer. Never abbreviate these to a bare enum. */
export const rightsLabels: Record<RightsState,string> = {
  PERMITTED: 'Permitted',
  RESTRICTED: 'Permitted with restrictions',
  UNKNOWN: 'Rights not yet established',
  PROHIBITED: 'Prohibited',
};
export const rightsExplanations: Record<RightsState,string> = {
  PERMITTED: 'This source has been reviewed and may be used for the uses listed below.',
  RESTRICTED: 'This source may be used, but the restrictions recorded below apply.',
  UNKNOWN: 'Nobody has established what this source permits. Outreach, export and republication stay blocked until an owner or admin reviews it.',
  PROHIBITED: 'This source may not be used for outreach, export or republication. That cannot be overridden by approving a proposal.',
};

export type SourceArtifact = Record_ & {
  filename: string;
  mediaType: string;
  sizeBytes?: number | null;
  sha256?: string | null;
  sourceOwner?: string | null;
  publisher?: string | null;
  acquisitionMethod: string;
  sourceUrl?: string | null;
  licenseTermsRef?: string | null;
  permittedUseBasis?: string | null;
  restrictions?: string | null;
  retentionStatus?: string | null;
  reviewStatus?: string | null;
  reviewAt?: string | null;
  rightsState: RightsState;
  permittedUses: PermittedUse[];
};
export type SourceClaim = Record_ & {
  artifactId: string;
  conversationId?: string | null;
  personId?: string | null;
  engagementId?: string | null;
  targetField: string;
  extractedValue: unknown;
  /** Free-form page/section citation recorded at extraction time. */
  locator: string;
  confidence: number;
  rightsState: RightsState;
  permittedUses: PermittedUse[];
};
/** An external chat. `durableUrl` is present only when the provider supplied a durable link. */
export type Conversation = Record_ & { provider: string; providerConversationId?: string | null; title?: string | null; durableUrl?: string | null };

export const approvalActions = ['people','engagements','meetings'] as const;
export type ApprovalAction = typeof approvalActions[number];
export const approvalStatuses = ['PENDING','APPROVED','REJECTED'] as const;
export type ApprovalStatus = typeof approvalStatuses[number];
export type Approval = Record_ & {
  action: string;
  payload: { data?: Record<string,unknown>; claimIds?: string[] } | null;
  rightsState: RightsState;
  status: ApprovalStatus;
  reason?: string | null;
  requesterMemberId?: string | null;
  requesterAgentId?: string | null;
  reviewerId?: string | null;
};
export type Agent = Record_ & { name?: string | null; status?: string | null };

/** Exactly the MCP scopes the backend accepts, with the plain-language meaning shown at selection. */
export const agentScopes = ['people:read','people:propose','engagements:read','engagements:propose','pipelines:read','notes:write','tasks:write','approvals:read','meetings:read','meetings:propose'] as const;
export type AgentScope = typeof agentScopes[number];
export const agentScopeNames: Record<AgentScope,string> = {
  'people:read': 'Read the people in this workspace.',
  'people:propose': 'Propose new people. Nothing is created until you approve it.',
  'engagements:read': 'Read engagements.',
  'engagements:propose': 'Propose engagements. Nothing is created until you approve it.',
  'pipelines:read': 'Read pipelines and their stages.',
  'notes:write': 'Add notes. Applied immediately, without approval.',
  'tasks:write': 'Create tasks. Applied immediately, without approval.',
  'approvals:read': 'Read the approval inbox.',
  'meetings:read': 'Read meetings.',
  'meetings:propose': 'Propose meetings. You confirm every invitation yourself.',
};
/** Scopes that take effect without an approval step, so they need a clear warning at selection. */
export const immediateAgentScopes: AgentScope[] = ['notes:write','tasks:write'];

/** Readable audit actions. An unmapped action falls back to its raw value rather than being hidden. */
export const auditActions: Record<string,string> = {
  'people.created':'Added a person','people.updated':'Edited a person','people.archived':'Archived a person',
  'organizations.created':'Added an organization','organizations.updated':'Edited an organization','organizations.archived':'Archived an organization',
  'engagements.created':'Created an engagement','engagements.updated':'Updated an engagement','engagements.archived':'Archived an engagement',
  'notes.created':'Added a note','tasks.created':'Created a task','tasks.updated':'Updated a task',
  'pipeline.created':'Created a pipeline','pipeline.updated':'Updated a pipeline',
  'stage.created':'Added a stage','stage.updated':'Updated a stage','stages.reordered':'Reordered stages',
  'approval.approved':'Approved a proposal','approval.rejected':'Rejected a proposal',
  'source.registered':'Registered a source','source.rights_reviewed':'Reviewed source rights',
  'oauth.client_registered':'Registered an agent','oauth.connection_revoked':'Revoked an agent connection',
};
export const actorLabels: Record<string,string> = { MEMBER:'Person', AGENT:'Agent', GUEST:'Guest', SYSTEM:'Caffriend' };
