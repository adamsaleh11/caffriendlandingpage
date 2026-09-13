export type Workspace = { id: string; name: string };
export type User = { id: string; name: string };
/**
 * Workspace navigation, in the order it is shown.
 *
 * Pipeline leads because it answers the question the CRM exists for — what is
 * happening with the people I am actively pursuing. People, by contrast, is the
 * roster: everyone in the workspace, whether or not anything is in flight.
 */
export const sections = ['pipeline', 'invites', 'people', 'inbox', 'calendar', 'organizations', 'agents', 'history', 'settings'] as const;
export type Section = typeof sections[number];
/** The default landing section: the last-used workspace opens on its pipeline. */
export const homeSection: Section = 'pipeline';
export const sectionNames: Record<Section, string> = {
  pipeline: 'Pipeline',
  invites: 'Coffee chat invites',
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
  pipeline: '\u25A4', invites: '\u2709', people: '\u25CE', inbox: '\u25A3', calendar: '\u25F7',
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
  if (value === '/events/new' || /^\/events\/[0-9a-f-]+(?:\/call)?$/i.test(value)) return value;
  const nested = value.match(/^\/app\/([^/]+)\/(meetings|people)\/([^/]+)$/);
  if (nested && uuidPattern.test(nested[1]) && uuidPattern.test(nested[3])) return value;
  const match = value.match(/^\/app\/([^/]+)\/([^/]+)$/);
  return match && uuidPattern.test(match[1]) && sections.includes(match[2] as Section) ? value : '/app';
}

export const providers = ['GOOGLE', 'MICROSOFT'] as const;
export type Provider = typeof providers[number];
export const providerNames: Record<Provider, string> = { GOOGLE: 'Google Calendar', MICROSOFT: 'Outlook Calendar' };
/** The mailbox behind each provider, for the send-as grant rather than the calendar. */
export const mailboxNames: Record<Provider, string> = { GOOGLE: 'Gmail', MICROSOFT: 'Outlook' };
export type ProviderStatus = { configured: boolean; errorCode?: string | null };
export type CalendarConnection = {
  id: string;
  provider: Provider;
  // The four the backend actually writes. It has never emitted 'CONNECTED' or
  // 'ERROR'; both were invented here, and every comparison against them was
  // dead — silently, because a filter that matches nothing looks like "not
  // connected yet" rather than a bug.
  status: 'ACTIVE' | 'SELECT_CALENDAR' | 'RECONNECT_REQUIRED' | 'DISCONNECTED';
  accountIdentifier?: string | null;
  calendarId?: string | null;
  calendarName?: string | null;
  // Required additive backend projection. Absent until that follow-up ships.
  scopes?: string[] | null;
  errorCode?: string | null;
};

/**
 * A connection Caffriend can still act through.
 *
 * ACTIVE is the settled state. SELECT_CALENDAR is a working credential whose
 * calendar is chosen on first use, so it can send mail and book exactly like an
 * ACTIVE one; treating it as unusable strands people who connected an account
 * and never picked a calendar. The other two are dead: DISCONNECTED was taken
 * away, RECONNECT_REQUIRED needs consent again.
 */
export const isLiveConnection = (status: CalendarConnection['status']) =>
  status === 'ACTIVE' || status === 'SELECT_CALENDAR';

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

export const meetingStatuses = ['LOCAL','BOOKED','CONFERENCE_PENDING','PENDING','CONFIRMED','FAILED','CANCEL_PENDING','CANCEL_FAILED','CANCELLED'] as const;
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
  BOOKED: 'Booked',
  CONFERENCE_PENDING: 'Creating the join link',
  PENDING: 'Sending the calendar invitation',
  CONFIRMED: 'Confirmed',
  FAILED: 'The calendar invitation failed',
  CANCEL_PENDING: 'Cancelling',
  CANCEL_FAILED: 'Cancellation failed',
  CANCELLED: 'Cancelled',
};
/** A meeting is joinable only while the server says it is scheduled. */
export const joinable = (status: MeetingStatus) => status === 'CONFIRMED' || status === 'BOOKED' || status === 'LOCAL';
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
/** Resources the backend allows a human member to permanently delete. */
export const deletableResources = ['people','organizations','engagements','notes','tasks'] as const;

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
  /** Where to read up on them before a chat. Stored as https only. */
  sourceUrl?: string | null;
  /** Why they are worth the time, in the user's own words. */
  discoveryReason?: string | null;
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
/** What each permission is called in front of a person. The scope string itself is never shown. */
export const agentScopeLabels: Record<AgentScope,string> = {
  'people:read': 'See your contacts',
  'people:propose': 'Suggest new contacts',
  'engagements:read': 'See your engagements',
  'engagements:propose': 'Suggest engagements',
  'pipelines:read': 'See your pipelines',
  'notes:write': 'Write notes',
  'tasks:write': 'Create tasks',
  'approvals:read': 'See your inbox',
  'meetings:read': 'See your meetings',
  'meetings:propose': 'Suggest meetings',
};
/** Scopes that take effect without an approval step, so they need a clear warning at selection. */
export const immediateAgentScopes: AgentScope[] = ['notes:write','tasks:write'];

/** Permissions grouped by how much trust each one asks for, in the order a person should read them. */
export const agentScopeGroups: { title: string; note: string; scopes: AgentScope[] }[] = [
  { title: 'Look at your workspace', note: 'Read-only. The agent can see this, and change nothing.',
    scopes: ['people:read','engagements:read','pipelines:read','meetings:read','approvals:read'] },
  { title: 'Suggest things for you to approve', note: 'Every suggestion waits in your Inbox until you approve it.',
    scopes: ['people:propose','engagements:propose','meetings:propose'] },
  { title: 'Make changes on its own', note: 'These happen right away, with no approval step. Grant them only to an agent you trust.',
    scopes: ['notes:write','tasks:write'] },
];

/** Readable audit actions. An unmapped action falls back to its raw value rather than being hidden. */
export const auditActions: Record<string,string> = {
  'people.created':'Added a person','people.updated':'Edited a person','people.archived':'Archived a person',
  'people.deleted':'Deleted a person',
  'organizations.created':'Added an organization','organizations.updated':'Edited an organization','organizations.archived':'Archived an organization',
  'organizations.deleted':'Deleted an organization',
  'engagements.created':'Created an engagement','engagements.updated':'Updated an engagement','engagements.archived':'Archived an engagement',
  'engagements.deleted':'Deleted an engagement',
  'notes.created':'Added a note','notes.archived':'Archived a note','notes.deleted':'Deleted a note',
  'tasks.created':'Created a task','tasks.updated':'Updated a task','tasks.archived':'Archived a task','tasks.deleted':'Deleted a task',
  'pipeline.created':'Created a pipeline','pipeline.updated':'Updated a pipeline',
  'stage.created':'Added a stage','stage.updated':'Updated a stage','stages.reordered':'Reordered stages',
  'approval.approved':'Approved a proposal','approval.rejected':'Rejected a proposal',
  'source.registered':'Registered a source','source.rights_reviewed':'Reviewed source rights',
  'oauth.client_registered':'Registered an agent','oauth.connection_revoked':'Revoked an agent connection',
  'meeting.created':'Scheduled a meeting','meeting.updated':'Updated a meeting','meeting.cancelled':'Cancelled a meeting',
  'outreach.mail_connect_started':'Started connecting a mailbox','outreach.mail_connected':'Connected a mailbox',
  'outreach.mail_disconnected':'Disconnected a mailbox','outreach.sent':'Sent outreach','outreach.bulk_sent':'Sent bulk outreach',
  'calendar.connected':'Connected a calendar','calendar.disconnected':'Disconnected a calendar',
};
export const actorLabels: Record<string,string> = { MEMBER:'Person', HUMAN:'Person', USER:'Person', AGENT:'Agent', GUEST:'Guest', SYSTEM:'Caffriend' };

/**
 * Readable names for what a change touched. The backend mixes plural resource
 * names with model names, so both spellings are mapped; anything unmapped falls
 * back to its raw value rather than being hidden.
 */
export const targetLabels: Record<string,string> = {
  people:'a person', person:'a person', Person:'a person',
  organizations:'an organization', organization:'an organization', Organization:'an organization',
  engagements:'an engagement', engagement:'an engagement', Engagement:'an engagement',
  notes:'a note', note:'a note', Note:'a note',
  tasks:'a task', task:'a task', Task:'a task',
  pipelines:'a pipeline', pipeline:'a pipeline', Pipeline:'a pipeline',
  stages:'a stage', stage:'a stage', Stage:'a stage',
  approvals:'a proposal', approval:'a proposal', Approval:'a proposal',
  meetings:'a meeting', meeting:'a meeting', Meeting:'a meeting',
  agents:'an agent', agent:'an agent', Agent:'an agent',
  CalendarConnection:'a calendar connection', calendar_connections:'a calendar connection',
  'source-artifacts':'a source', SourceArtifact:'a source',
  'source-claims':'a cited claim', SourceClaim:'a cited claim',
  conversations:'a chat', Conversation:'a chat',
};

/**
 * A last resort for an action this UI has no wording for: turn
 * `outreach.mail_connect_started` into `Outreach: mail connect started` so an
 * unmapped event still reads as a sentence instead of an identifier.
 */
export function describeAction(action: string): string {
  const [group, ...rest] = action.split('.');
  const tail = rest.join(' ').replace(/[._-]+/g, ' ').trim();
  const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  if (!tail) return sentence(group.replace(/[._-]+/g, ' '));
  return `${sentence(group.replace(/[._-]+/g, ' '))}: ${tail}`;
}
