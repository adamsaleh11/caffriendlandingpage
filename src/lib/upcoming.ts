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
  /** Where Join goes. Null while the room or the link is still pending. */
  href: string | null;
  /** A provider conference opens in its own tab; a Caffriend room does not. */
  external: boolean;
  needsPayment: boolean;
  /** The collaboration room, where the notes, chat and commitments live. */
  groupCallId: string | null;
  /** Set when this booking also has a CRM meeting record to open. */
  meetingId: string | null;
};

/**
 * The native join window, in minutes before the start.
 *
 * `canJoinMeeting` in the iOS app: a meeting opens five minutes before it starts and
 * not before. The web used to offer Join at any time, which let someone walk into an
 * empty room days early.
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
    key: call.meetingId || `call:${call.id}`,
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
  };
}

/** A meeting booked from a CRM invitation. */
export function fromMeeting(meeting: Meeting): UpcomingMeeting {
  const open = joinable(meeting.status);
  return {
    key: meeting.id,
    title: meeting.purpose || 'Meeting',
    counterpart: null,
    image: null,
    startsAt: meeting.startsAt || null,
    endsAt: meeting.endsAt || null,
    where: meeting.physicalLocation
      || (meeting.joinUrl || meeting.groupCallId
        ? meeting.groupCallId ? 'Caffriend call' : meeting.provider === 'MICROSOFT' ? 'Microsoft Teams' : 'Google Meet'
        : null),
    status: sentence(meeting.status),
    notes: meeting.agenda ?? null,
    href: !open ? null : meeting.groupCallId ? `/calls/${meeting.groupCallId}` : meeting.joinUrl ?? null,
    external: open && !meeting.groupCallId && Boolean(meeting.joinUrl),
    needsPayment: false,
    groupCallId: meeting.groupCallId ?? null,
    meetingId: meeting.id,
  };
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
