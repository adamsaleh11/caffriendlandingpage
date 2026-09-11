export type Workspace = { id: string; name: string };
export type User = { id: string; name: string };
export const sections = ['people', 'pipeline', 'inbox', 'agents', 'calendar', 'settings'] as const;
export type Section = typeof sections[number];
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function safeReturn(value: unknown): string {
  if (typeof value !== 'string') return '/app';
  if (value === '/app' || value === '/app/workspaces/new') return value;
  const meeting = value.match(/^\/app\/([^/]+)\/meetings\/([^/]+)$/);
  if (meeting && uuidPattern.test(meeting[1]) && uuidPattern.test(meeting[2])) return value;
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
export type CalendarOption = { id: string; name?: string | null; writable?: boolean };
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
  targetType: string;
  targetId: string;
};
