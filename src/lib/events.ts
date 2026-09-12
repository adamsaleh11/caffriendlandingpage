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
