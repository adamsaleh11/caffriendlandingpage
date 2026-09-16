import type { AppCall } from './app-projection';
import { joinable, type Meeting } from './contracts';

/**
 * One upcoming meeting, however it was booked.
 *
 * Two things book a meeting and neither sees the other's record. A coffee chat booked
 * through the consumer flow arrives as an accepted calendar event (`AppCall`); a meeting
 * booked from a CRM invitation arrives as a `Meeting`. The Meetings page used to read
 * only the first, so a CRM-booked meeting appeared nowhere and could not be joined.
 * Both are projected here so one list and one calendar can hold both.
 */
export type UpcomingMeeting = {
  /** Stable across the two sources: the meeting's own id wins wherever there is one. */
  key: string;
  title: string;
  counterpart: string | null;
  image: string | null;
  startsAt: string | null;
  endsAt: string | null;
  where: string | null;
  /** A short status word, already in display case. Absent when there is nothing to say. */
  status: string | null;
  notes: string | null;
  /**
   * Where Join goes. Null means there is nowhere to go and never will be: a room is
   * written with the booking, so a Caffriend call without one is a broken booking, not
   * a pending one. An in-person meeting is null for the ordinary reason that it has no
   * room at all.
   */
  href: string | null;
  /** A provider conference opens in its own tab; a Caffriend room does not. */
  external: boolean;
  needsPayment: boolean;
  /** The collaboration room, where the notes, chat and commitments live. */
  groupCallId: string | null;
  /** Set when this booking also has a CRM meeting record to open. */
  meetingId: string | null;
  /** Unified meeting flow: indicates meeting origin - 'CRM' for desktop, 'CAFFRIEND' for mobile */
  source: 'CRM' | 'CAFFRIEND' | null;
  /** Where the meeting is held. A place to be has no room, and needs none. */
  venue: 'CAFFRIEND_LIVEKIT' | 'PROVIDER_CONFERENCE' | 'IN_PERSON' | null;
};

/**
 * What the card offers where Join goes.
 *
 * `open` and `early` are both real bookings with a room behind them; `unavailable` is
 * a booking whose room is missing, which is a breakage rather than a wait. A
 * `groupCallId` is written in the same transaction as the booking and is never filled
 * in later, so nothing about it clears with time.
 */
export type JoinState = 'payment' | 'none' | 'unavailable' | 'early' | 'open';

export function joinState(meeting: UpcomingMeeting, now: number): JoinState {
  if (meeting.needsPayment) return 'payment';
  // A place to be, with nothing to press and nothing wrong.
  if (meeting.venue === 'IN_PERSON') return 'none';
  if (!meeting.href) return 'unavailable';
  return canJoinAt(meeting.startsAt, now) ? 'open' : 'early';
}

/**
 * The join window, in minutes before the start.
 *
 * `canJoinMeeting` in the iOS app: a meeting opens five minutes before it starts and
 * not before. This is a product rule the two clients share, not a server one — a member
 * may join at any hour and the room is minted on first arrival — and the web keeps it so
 * that the phone and the desktop do not disagree about when a call can be entered.
 */
export const JOIN_WINDOW_MINUTES = 5;

export function canJoinAt(startsAt: string | null, now: number): boolean {
  if (!startsAt) return false;
  const start = Date.parse(startsAt);
  if (!Number.isFinite(start)) return false;
  return (start - now) / 60000 <= JOIN_WINDOW_MINUTES;
}

/**
 * How long until it opens, for the too-early notice.
 *
 * The native text is day-granular, which reads as "Starting today" for a meeting six
 * hours out. Hours and minutes are spelled out here instead, because on this page the
 * question the notice has to answer is "can I go and make a coffee first".
 */
export function startsInText(startsAt: string | null, now: number): string {
  if (!startsAt) return 'Not scheduled yet';
  const start = Date.parse(startsAt);
  if (!Number.isFinite(start)) return 'Time unavailable';
  const minutes = Math.round((start - now) / 60000);
  if (minutes <= 0) return 'Already started';
  const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;
  if (minutes < 60) return `Starts in ${plural(minutes, 'minute')}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Starts in ${plural(hours, 'hour')}`;
  return `Starts in ${plural(Math.round(hours / 24), 'day')}`;
}

/**
 * What to tell someone who pressed Join too early.
 *
 * Both halves matter: the rule, so the window is not a surprise the next time, and the
 * clock time the room opens, so they can go away and come back rather than watch a
 * countdown. The room genuinely does not exist yet — walking in early reached a call
 * that could not be loaded, which read as a broken booking rather than an early arrival.
 */
export function joinOpensText(startsAt: string | null, now: number): string {
  if (!startsAt) return 'This call is not scheduled yet.';
  const start = Date.parse(startsAt);
  if (!Number.isFinite(start)) return 'This call is not scheduled yet.';
  const opens = new Date(start - JOIN_WINDOW_MINUTES * 60000);
  const clock = opens.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
  const sameDay = new Date(now).toDateString() === opens.toDateString();
  const day = sameDay ? '' : ` on ${opens.toLocaleDateString(undefined, {weekday:'long', month:'short', day:'numeric'})}`;
  return `You can join 5 minutes before the call starts. The room opens at ${clock}${day}.`;
}

const venueLabel = (call: AppCall) =>
  call.venue === 'CAFFRIEND_LIVEKIT' ? 'Caffriend call'
    : call.venue === 'PROVIDER_CONFERENCE' ? 'Google Meet'
    : call.physicalLocation || call.format || null;

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

const sentence = (value: string) => value.toLowerCase().replaceAll('_', ' ');

/**
 * Build the display title for a call.
 *
 * When the event carries a purpose (e.g. "Coffee chat") that does NOT already
 * mention the other person's name, append "with [Name]" so the card heading is
 * "Coffee chat with Alice" instead of just "Coffee chat". If the purpose already
 * contains the name, or there is no counterpart to add, use the purpose as-is.
 * When there is no purpose at all, fall back to "Meeting with [Name]".
 */
function callTitle(call: AppCall): string {
  const purpose = call.purpose;
  const name = call.counterpart ? firstName(call.counterpart) : null;

  if (!purpose) return name ? `Meeting with ${name}` : 'Coffee chat';

  // Already personalised ("Coffee chat with Alice" or "Meeting with Bob").
  if (name && purpose.toLowerCase().includes(name.toLowerCase())) return purpose;

  // Generic purpose + known counterpart → personalise it.
  if (name) return `${purpose} with ${name}`;

  return purpose;
}

/** An accepted coffee chat, as it comes back from `/calendar/accepted-events`. */
export function fromCall(call: AppCall): UpcomingMeeting {
  return {
    key: `call:${call.id}`,
    title: callTitle(call),
    counterpart: call.counterpart,
    image: call.image,
    startsAt: call.startDate,
    endsAt: call.endDate,
    where: venueLabel(call),
    status: call.status ? sentence(call.status) : null,
    notes: call.notes,
    // A Caffriend call has a collaboration room of its own. It is the same address
    // before, during and after the call, so the chat, notes, commitments and agenda
    // stay reachable once the call itself is over.
    href: call.groupCallId ? `/calls/${call.groupCallId}` : call.joinUrl,
    external: !call.groupCallId && call.venue === 'PROVIDER_CONFERENCE',
    needsPayment: call.needsPayment,
    groupCallId: call.groupCallId,
    meetingId: call.meetingId,
    source: call.source,
    venue: call.venue ?? null,
  };
}

/** A meeting booked from a CRM invitation. */
export function fromMeeting(meeting: Meeting): UpcomingMeeting {
  const open = joinable(meeting.status);
  // Use venue field for unified meeting flow - fallback to provider logic for backward compatibility
  const venue = meeting.venue;
  const where = meeting.physicalLocation
    || (venue === 'CAFFRIEND_LIVEKIT' ? 'Caffriend call'
      : venue === 'PROVIDER_CONFERENCE' ? (meeting.provider === 'MICROSOFT' ? 'Microsoft Teams' : 'Google Meet')
      : venue === 'IN_PERSON' ? meeting.physicalLocation || 'In person'
      : (meeting.joinUrl || meeting.groupCallId
        ? meeting.groupCallId ? 'Caffriend call' : meeting.provider === 'MICROSOFT' ? 'Microsoft Teams' : 'Google Meet'
        : null));
  
  // Use venue field for join flow determination
  const href = !open ? null 
    : venue === 'CAFFRIEND_LIVEKIT' && meeting.groupCallId ? `/calls/${meeting.groupCallId}`
    : venue === 'PROVIDER_CONFERENCE' ? meeting.joinUrl ?? null
    : venue === 'IN_PERSON' ? null
    : meeting.groupCallId ? `/calls/${meeting.groupCallId}` : meeting.joinUrl ?? null;
  
  const external = open && venue === 'PROVIDER_CONFERENCE' && Boolean(meeting.joinUrl);
  
  return {
    key: meeting.id,
    title: meeting.purpose || 'Meeting',
    counterpart: null,
    image: null,
    startsAt: meeting.startsAt || null,
    endsAt: meeting.endsAt || null,
    where,
    status: sentence(meeting.status),
    notes: meeting.agenda ?? null,
    href,
    external,
    needsPayment: false,
    groupCallId: meeting.groupCallId ?? null,
    meetingId: meeting.id,
    source: meeting.source || 'CRM', // Default to 'CRM' for desktop meetings
    venue: meeting.venue ?? null,
  };
}


/**
 * Every accepted coffee, earliest first — including the ones that have already happened.
 *
 * One feed backs this: `GET /calendar/accepted-events/:type`, the same endpoint the
 * Meetings page, desktop Upcoming Calls and the phone all read. A desktop-booked coffee
 * is recorded three times on purpose — the canonical meeting, the attendee's mirror and
 * the legacy projection — and the server collapses them before they get here. So no row
 * is merged away: two rows are two coffees, and one coffee appearing twice is a backend
 * bug to report rather than something to paper over here.
 */
export function coffees(calls: AppCall[]): UpcomingMeeting[] {
  return calls
    .map(fromCall)
    .filter(row => row.startsAt)
    .sort((a, b) => (Date.parse(a.startsAt ?? '') || 0) - (Date.parse(b.startsAt ?? '') || 0));
}

/**
 * Both sources as one list, earliest first — including meetings that have already
 * happened.
 *
 * The two sources overlap: a CRM meeting that also produced an accepted calendar event
 * arrives twice. The `Meeting` record wins that tie because it is the one carrying the
 * booking's real status, and it is the one the meeting page opens on.
 */
export function mergeMeetings(calls: AppCall[], meetings: Meeting[]): UpcomingMeeting[] {
  const rows = new Map<string, UpcomingMeeting>();
  for (const call of calls) {
    const row = fromCall(call);
    rows.set(row.key, row);
  }
  for (const meeting of meetings) {
    if (meeting.status === 'CANCELLED') { rows.delete(meeting.id); continue; }
    const row = fromMeeting(meeting);
    const existing = rows.get(row.key);
    if (!existing) { rows.set(row.key, row); continue; }
    /**
     * The accepted calendar event is the live record of when a meeting is and who is
     * in it: a reschedule reaches the calendar first, and the meeting record can lag
     * behind it. So the event keeps the time, the counterpart and the room it already
     * has, and the meeting record only fills in what the event does not carry.
     */
    rows.set(row.key, {
      ...existing,
      status: row.status ?? existing.status,
      where: existing.where ?? row.where,
      notes: existing.notes ?? row.notes,
      href: existing.href ?? row.href,
      groupCallId: existing.groupCallId ?? row.groupCallId,
      meetingId: existing.meetingId ?? row.meetingId,
      source: row.source ?? existing.source, // Prefer meeting source (CRM) over call source
    });
  }
  return [...rows.values()]
    .filter(row => row.startsAt)
    .sort((a, b) => (Date.parse(a.startsAt ?? '') || 0) - (Date.parse(b.startsAt ?? '') || 0));
}

/** Whether a meeting is still ahead: it has not ended, or has not started when no end is known. */
export function stillAhead(row: UpcomingMeeting, now: number): boolean {
  return Boolean(row.startsAt) && (Date.parse(row.endsAt ?? row.startsAt ?? '') || 0) >= now;
}

/**
 * Everything still ahead, earliest first.
 *
 * Used where the question is "what can I join next". A calendar asks a different
 * question — what is on this day — and reads `mergeMeetings` instead, so a meeting
 * booked for this afternoon does not empty today's cell the moment it ends.
 */
export function mergeUpcoming(calls: AppCall[], meetings: Meeting[], now: number): UpcomingMeeting[] {
  return mergeMeetings(calls, meetings).filter(row => stillAhead(row, now));
}
