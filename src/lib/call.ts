/**
 * The video-call collaboration surface, as `GET /group-calls/:id/call-state` returns it.
 *
 * A 1:1 coffee chat and a group call are the same shape: accepting a coffee seats both
 * attendees in a `COFFEE_CHAT` room, already admitted, so the waiting room is simply
 * empty rather than a different screen.
 */
export type WaitingStatus = 'waiting' | 'admitted' | 'declined' | 'removed';
export type ParticipantRole = 'host' | 'co_host' | 'participant';

export type CallParticipant = {
  id: string;
  userId: string;
  displayName: string;
  jobTitle?: string | null;
  company?: string | null;
  image?: string | null;
  role: ParticipantRole;
  micOn: boolean;
  cameraOn: boolean;
  handRaised: boolean;
  screenShareOn: boolean;
  connectionQuality: string;
  activeSpeaker: boolean;
  pinned: boolean;
  waitingStatus: WaitingStatus;
  leftAt?: string | null;
};

export type CallRoom = {
  id: string;
  title: string | null;
  kind: string;
  status: string;
  roomName: string;
  locked: boolean;
  muteOnEntry: boolean;
  hostId: string;
  /** When the LiveKit room was minted, which is when the first person joined. */
  startedAt: string | null;
  endedAt: string | null;
};

/** A resource card is stored as free-form JSON; only a title and a link are relied on. */
export type ResourceCard = { title: string; url: string | null; meta: string | null };

export type CallMessage = {
  id: string;
  senderId: string;
  message: string;
  createdAt: string | null;
  mentions: string[];
  resourceCards: ResourceCard[];
  replyToMessageId: string | null;
};

export type NoteScope = 'private' | 'shared' | 'ai';

export type CallNote = { id: string; authorUserId: string; scope: NoteScope; body: string; createdAt: string | null };
export type CallActionItem = { id: string; ownerUserId: string | null; text: string; dueAt: string | null; done: boolean };
export type CallAgendaBlock = { id: string; title: string; prompt: string | null; sortOrder: number; completed: boolean };

export type CallState = {
  room: CallRoom;
  participants: CallParticipant[];
  waitingRoom: CallParticipant[];
  chat: { threadId: string | null; messages: CallMessage[] };
  notes: CallNote[];
  actionItems: CallActionItem[];
  agendaBlocks: CallAgendaBlock[];
};

const text = (value: unknown): string | null => typeof value === 'string' && value ? value : null;
const flag = (value: unknown, fallback = false): boolean => typeof value === 'boolean' ? value : fallback;

const roles: ParticipantRole[] = ['host', 'co_host', 'participant'];
const statuses: WaitingStatus[] = ['waiting', 'admitted', 'declined', 'removed'];

/**
 * Legacy participant rows predate the collaboration columns, so every live field
 * falls back to the contract's documented default rather than to `undefined` —
 * an older row reads as present with its camera and microphone on.
 */
export function projectParticipant(row: Record<string, unknown>): CallParticipant {
  const role = roles.find(value => value === row.role) ?? 'participant';
  const waitingStatus = statuses.find(value => value === row.waitingStatus) ?? 'admitted';
  return {
    id: String(row.id ?? ''),
    userId: String(row.userId ?? ''),
    displayName: text(row.displayName) ?? text(row.name) ?? 'Caffriend member',
    jobTitle: text(row.jobTitle),
    company: text(row.company),
    image: text(row.image),
    role,
    micOn: flag(row.micOn, true),
    cameraOn: flag(row.cameraOn, true),
    handRaised: flag(row.handRaised),
    screenShareOn: flag(row.screenShareOn),
    connectionQuality: text(row.connectionQuality) ?? 'unknown',
    activeSpeaker: flag(row.activeSpeaker),
    pinned: flag(row.pinned),
    waitingStatus,
    leftAt: text(row.leftAt),
  };
}

function projectResourceCard(row: Record<string, unknown>): ResourceCard {
  return {title: text(row.title) ?? 'Shared resource', url: text(row.url), meta: text(row.meta)};
}

export function projectMessage(row: Record<string, unknown>): CallMessage {
  const cards = Array.isArray(row.resourceCards) ? row.resourceCards as unknown[] : [];
  return {
    id: String(row.id ?? ''),
    senderId: String(row.senderId ?? ''),
    message: text(row.message) ?? '',
    createdAt: text(row.createdAt),
    mentions: Array.isArray(row.mentions) ? row.mentions.filter((value): value is string => typeof value === 'string') : [],
    resourceCards: cards.filter((card): card is Record<string, unknown> => !!card && typeof card === 'object').map(projectResourceCard),
    replyToMessageId: text(row.replyToMessageId),
  };
}

const scopes: NoteScope[] = ['private', 'shared', 'ai'];

export function projectNote(row: Record<string, unknown>): CallNote {
  return {
    id: String(row.id ?? ''),
    authorUserId: String(row.authorUserId ?? ''),
    scope: scopes.find(value => value === row.scope) ?? 'shared',
    body: text(row.body) ?? '',
    createdAt: text(row.createdAt),
  };
}

export function projectActionItem(row: Record<string, unknown>): CallActionItem {
  return {
    id: String(row.id ?? ''),
    ownerUserId: text(row.ownerUserId),
    text: text(row.text) ?? '',
    dueAt: text(row.dueAt),
    done: flag(row.done),
  };
}

export function projectAgendaBlock(row: Record<string, unknown>): CallAgendaBlock {
  return {
    id: String(row.id ?? ''),
    title: text(row.title) ?? 'Agenda block',
    prompt: text(row.prompt),
    sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
    completed: flag(row.completed),
  };
}

/**
 * The backend can emit more than one participant row for the same person (e.g. a row
 * seeded at booking time and a separate one created when they actually connect), so the
 * roster is deduped by `userId` — last row wins, since it reflects the most recent state.
 */
function dedupeByUserId(rows: CallParticipant[]): CallParticipant[] {
  const byUserId = new Map<string, CallParticipant>();
  for (const row of rows) byUserId.set(row.userId, row);
  return [...byUserId.values()];
}

export function projectCallState(body: unknown): CallState {
  const value = (body ?? {}) as Record<string, unknown>;
  const room = (value.room ?? {}) as Record<string, unknown>;
  const chat = (value.chat ?? {}) as Record<string, unknown>;
  const table = (key: string) => Array.isArray(value[key]) ? value[key] as Record<string, unknown>[] : [];
  const rows = (key: string) => table(key).map(projectParticipant);
  return {
    room: {
      id: String(room.id ?? ''),
      title: text(room.title),
      kind: String(room.kind ?? 'COFFEE_CHAT'),
      status: String(room.status ?? 'OPEN'),
      roomName: String(room.roomName ?? ''),
      locked: flag(room.locked),
      muteOnEntry: flag(room.muteOnEntry),
      hostId: String(room.hostId ?? ''),
      // §4 names `roomProvisionedAt`; older rows were minted eagerly and carry only
      // `createdAt`, so both are accepted and the call simply has no clock without them.
      startedAt: text(room.roomProvisionedAt) ?? text(room.startedAt) ?? text(room.createdAt),
      endedAt: text(room.endedAt),
    },
    // A participant who has left is history, not someone in the room.
    participants: dedupeByUserId(rows('participants').filter(row => !row.leftAt && row.waitingStatus === 'admitted')),
    waitingRoom: dedupeByUserId(rows('waitingRoom').filter(row => row.waitingStatus === 'waiting')),
    chat: {
      // A thread is minted on the first send, so "no thread yet" means "no messages yet".
      threadId: text(chat.threadId),
      messages: Array.isArray(chat.messages) ? (chat.messages as Record<string, unknown>[]).map(projectMessage) : [],
    },
    notes: table('notes').map(projectNote),
    actionItems: table('actionItems').map(projectActionItem),
    // The contract carries order in `sortOrder`, not in the array order.
    agendaBlocks: table('agendaBlocks').map(projectAgendaBlock).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

/**
 * One row of the caller's call history, from `GET /group-calls/mine`.
 *
 * This is the only listing that names every call a person was in. An accepted calendar
 * event cannot stand in for it: that row is a booking between two people against one
 * availability slot, so it has no participants array and structurally never represents
 * a group call.
 */
export type MyCall = {
  id: string;
  title: string | null;
  kind: string;
  status: string;
  hostId: string;
  startsAt: string | null;
  endedAt: string | null;
  meetingId: string | null;
  createdAt: string | null;
};

export function projectMyCall(row: Record<string, unknown>): MyCall {
  return {
    id: String(row.id ?? ''),
    title: text(row.title),
    kind: String(row.kind ?? 'COFFEE_CHAT'),
    status: String(row.status ?? 'OPEN'),
    hostId: String(row.hostId ?? ''),
    // Null for an instant coffee that was never scheduled; such a row orders by creation.
    startsAt: text(row.startsAt),
    endedAt: text(row.endedAt),
    // Cross-reference only. It is a Meeting id, never a call id.
    meetingId: text(row.meetingId),
    createdAt: text(row.createdAt),
  };
}

/** A call is finished when the host ended the structured portion. */
export const callFinished = (call: MyCall) => call.status === 'ENDED' || Boolean(call.endedAt);

/** Someone is only ever named for themselves as "You". */
export const participantName = (participant: CallParticipant, me: string) =>
  participant.userId === me ? 'You' : participant.displayName;

/**
 * A live `call.*` event applied to the loaded call.
 *
 * Events patch what they carry and leave the rest alone, because the alternative —
 * refetching the whole call on every change — would drop everyone's live mic, camera
 * and hand state each time one person typed a message.
 */
export function applyCallEvent(state: CallState, event: string, payload: Record<string, unknown>, me: string): CallState {
  const row = (key: string) => (payload[key] ?? {}) as Record<string, unknown>;
  switch (event) {
    case 'call.room.updated': {
      const room = projectCallState({room:row('room')}).room;
      return {...state, room:{...state.room, ...room, id:state.room.id}};
    }
    case 'call.participant.updated': {
      const person = projectParticipant(row('participant'));
      const known = state.participants.some(value => value.userId === person.userId);
      return {...state, participants: known
        ? state.participants.map(value => value.userId === person.userId ? {...value, ...person} : value)
        : [...state.participants, person]};
    }
    case 'call.waiting.admitted': {
      const person = projectParticipant(row('participant'));
      return {...state,
        waitingRoom: state.waitingRoom.filter(value => value.id !== person.id),
        participants: dedupeByUserId([...state.participants.filter(value => value.userId !== person.userId), person])};
    }
    case 'call.waiting.declined':
      return {...state, waitingRoom: state.waitingRoom.filter(value => value.id !== String(row('participant').id))};
    case 'call.participant.removed': {
      const id = String(row('participant').id);
      return {...state, participants: state.participants.filter(value => value.id !== id)};
    }
    case 'call.chat.message.created': {
      const message = projectMessage(row('message'));
      return state.chat.messages.some(value => value.id === message.id)
        ? state : {...state, chat:{...state.chat, messages:[...state.chat.messages, message]}};
    }
    case 'call.note.created': {
      const note = projectNote(row('note'));
      // A private note is broadcast with its body redacted; only its author gets the
      // text, and they already have it from their own response.
      if (note.scope === 'private' && note.authorUserId !== me) return state;
      return state.notes.some(value => value.id === note.id) ? state : {...state, notes:[...state.notes, note]};
    }
    case 'call.action_item.created':
    case 'call.action_item.updated': {
      const item = projectActionItem(row('actionItem'));
      const known = state.actionItems.some(value => value.id === item.id);
      return {...state, actionItems: known
        ? state.actionItems.map(value => value.id === item.id ? item : value)
        : [...state.actionItems, item]};
    }
    case 'call.agenda.created': {
      const block = projectAgendaBlock(row('agendaBlock'));
      if (state.agendaBlocks.some(value => value.id === block.id)) return state;
      return {...state, agendaBlocks:[...state.agendaBlocks, block].sort((a, b) => a.sortOrder - b.sortOrder)};
    }
    default:
      return state;
  }
}

export const callEvents = [
  'call.room.updated', 'call.participant.updated', 'call.waiting.admitted', 'call.waiting.declined',
  'call.participant.removed', 'call.chat.message.created', 'call.note.created',
  'call.action_item.created', 'call.action_item.updated', 'call.agenda.created',
] as const;
