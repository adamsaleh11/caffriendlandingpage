export type EventSummary = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  listed: boolean;
  priceCents: number;
  currency: string;
  status: 'OPEN' | 'ENDED';
  capacity: number;
  isHost?: boolean;
};

export type EventDetails = Pick<EventSummary, 'id'|'title'|'description'|'startsAt'> & {
  kind: 'EVENT';
  micOpenOnArrival: boolean;
};

export type RosterMember = {
  participantId: string;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
  canConnect: boolean;
  reasons: string[];
};

export type SpotlightState = {
  holderId: string | null;
  remainingMs: number;
  reconnecting: boolean;
  finished: boolean;
};

export type EventCredentials = {token:string; url:string; participantId?:string};

export const eventCapacity = 50;
export const videoPageSize = 9;

/** The most recipients `POST /group-calls/:id/invite` accepts in one send. */
export const inviteLimit = 50;
export type InviteRecipient = {userId: string} | {email: string};

/**
 * Who to invite to a group call, from the two ways of naming a person.
 *
 * Connections are named by user id and outside addresses by email, and they go in one
 * list because they are one act: the host is inviting people, not running two flows. A
 * connection gets both an email and an in-app request; an address gets the email, and
 * that invitation is itself the registration — nobody invited here registers separately.
 */
export function inviteRecipients(userIds: string[], addresses: string): {value: InviteRecipient[]; problem?: string} {
  const typed = addresses.split(/[\s,;]+/).map(entry => entry.trim()).filter(Boolean);
  const bad = typed.find(entry => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry));
  if (bad) return {value: [], problem: `${bad} is not an email address.`};
  const emails = [...new Set(typed.map(entry => entry.toLowerCase()))];
  const value: InviteRecipient[] = [
    ...[...new Set(userIds)].map(userId => ({userId})),
    ...emails.map(email => ({email})),
  ];
  if (!value.length) return {value, problem: 'Choose someone to invite, or type an email address.'};
  if (value.length > inviteLimit) return {value, problem: `Invite up to ${inviteLimit} people at a time.`};
  return {value};
}
