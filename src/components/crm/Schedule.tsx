'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useRows, Section, Empty } from './common';
import Modal from './Modal';
import Face from '@/components/app/Face';
import type { AppCall } from '@/lib/app-projection';
import { canJoinAt, coffees, joinOpensText, stillAhead, type UpcomingMeeting } from '@/lib/upcoming';
import UpcomingMeetings, { MeetingCard, type MeetingLine } from '@/components/app/UpcomingMeetings';
import { callCounterpart, callFinished, type CallState, type MyCall } from '@/lib/call';

/**
 * Calls, as a calendar.
 *
 * Upcoming calls are shown on a month grid rather than as a list, because the question
 * people actually bring to this page is "what does my week look like", which a list of
 * rows answers badly. Past calls stay a list: they are looked up by who and what, not by
 * when, and each one opens on what the call produced.
 */

const DAY = 86400000;
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const timeLabel = (value?: string | null) =>
  value ? new Date(value).toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'}) : '';
const dayLabel = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'}) : 'Not scheduled';
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Monday-first, so a week reads as a working week. */
function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first.getTime() - offset * DAY);
  return Array.from({length: 42}, (_, index) => new Date(start.getTime() + index * DAY));
}

const minutesBetween = (from?: string | null, to?: string | null) => {
  if (!from || !to) return null;
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 60000);
  return Number.isFinite(span) && span > 0 ? span : null;
};

/**
 * What one call on the calendar actually is, opened in place.
 *
 * A day square is too small to say anything useful, and one that navigated straight
 * into a LiveKit room was a trap: joining was the only thing it could do, so the notes,
 * the chat and the meeting record were unreachable from the calendar — and a square
 * with no join link at all did nothing when clicked. Every square opens this instead.
 */
function CallDetail({call, workspaceId, past, now, onClose}:{
  call: UpcomingMeeting; workspaceId: string; past: boolean; now: number; onClose: () => void;
}) {
  const minutes = minutesBetween(call.startsAt, call.endsAt);
  // The same five-minute window the list and the phone use. A square opened days early
  // used to walk straight into a room that had not been provisioned.
  const early = !past && !canJoinAt(call.startsAt, now);
  return <Modal title={call.title} description={call.counterpart ?? undefined} onClose={onClose}>
    {/* The same face and heading the card in the list carries, so opening one from the
        month grid lands somewhere recognisable. */}
    <div className="call-detail-identity">
      <Face person={{name: call.counterpart || call.title, image: call.image}} />
      <div>
        <p className="call-detail-who">{call.counterpart || call.title}</p>
        <p className="small">{past ? 'This call has finished' : 'Still to come'}
          {minutes ? ` · ${minutes} min` : ''}</p>
      </div>
    </div>
    <dl className="call-detail">
      <div><dt>When</dt><dd>
        {dayLabel(call.startsAt)}
        {call.startsAt && ` · ${timeLabel(call.startsAt)}`}
        {call.endsAt && ` - ${timeLabel(call.endsAt)}`}
      </dd></div>
      <div><dt>Where</dt><dd>{call.where || 'Not specified'}</dd></div>
      {call.status && <div><dt>Status</dt><dd>{call.status}</dd></div>}
      {call.counterpart && <div><dt>With</dt><dd>{call.counterpart}</dd></div>}
      {call.notes && <div><dt>Agenda</dt><dd>{call.notes}</dd></div>}
    </dl>
    <div className="call-detail-actions">
      {/* Whichever the call needs is the primary: joining one that is ahead, reading
          what a finished one produced. Notes is a page, never the live call surface. */}
      {!past && call.href && (early
        ? <p className="small">{joinOpensText(call.startsAt, now)}</p>
        : call.external
          ? <a className="button" href={call.href} target="_blank" rel="noreferrer noopener">Join</a>
          : <Link className="button" href={call.href}>Join</Link>)}
      {call.groupCallId && <Link className={past ? 'button' : 'text-link'}
        href={`/app/${workspaceId}/calls/${call.groupCallId}`}>Call notes</Link>}
      {call.meetingId &&
        <Link className="text-link" href={`/app/${workspaceId}/meetings/${call.meetingId}`}>Meeting details</Link>}
      {!call.groupCallId && !call.meetingId && !call.href &&
        <p className="small">This call has no room or join link yet.</p>}
    </div>
  </Modal>;
}

function CallCalendar({calls, now, workspaceId}:{calls: UpcomingMeeting[]; now: number; workspaceId: string}) {
  const [open, setOpen] = useState<UpcomingMeeting>();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const today = new Date();
  const days = useMemo(() => monthGrid(month), [month]);
  const monthName = month.toLocaleDateString(undefined, {month:'long', year:'numeric'});
  const move = (by: number) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + by, 1));

  const forDay = (day: Date) => calls.filter(call =>
    call.startsAt && sameDay(new Date(call.startsAt), day));

  return <div className="cal">
    <div className="cal-head">
      <button className="secondary" onClick={() => move(-1)} aria-label="Previous month">←</button>
      <h3 aria-live="polite">{monthName}</h3>
      <button className="secondary" onClick={() => move(1)} aria-label="Next month">→</button>
      <button className="secondary cal-today"
        onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button>
    </div>
    <div className="cal-weekdays" aria-hidden="true">
      {weekdays.map(day => <span key={day}>{day}</span>)}
    </div>
    <div className="cal-grid" role="grid" aria-label={`Calls in ${monthName}`}>
      {days.map(day => {
        const onDay = forDay(day);
        const outside = day.getMonth() !== month.getMonth();
        return <div key={day.toISOString()} role="gridcell" className="cal-day"
          data-outside={outside ? 'true' : undefined} data-today={sameDay(day, today) ? 'true' : undefined}>
          <span className="cal-date">{day.getDate()}</span>
          {onDay.map(call => <button key={call.key} type="button" className="cal-event"
            data-past={!stillAhead(call, now) ? 'true' : undefined}
            onClick={() => setOpen(call)}>
            <span className="cal-event-time">{timeLabel(call.startsAt)}</span>
            <span className="cal-event-who">{call.counterpart || call.title}</span>
          </button>)}
        </div>;
      })}
    </div>
    {open && <CallDetail call={open} workspaceId={workspaceId} past={!stillAhead(open, now)} now={now}
      onClose={() => setOpen(undefined)} />}
  </div>;
}

/** Who the viewer is, so they can be left out of a call's roster. */
function useMyId(): string {
  const [me, setMe] = useState('');
  useEffect(() => {
    let live = true;
    api<{id?:string}>('me', {}, 'app')
      .then(profile => { if (live && profile?.id) setMe(profile.id); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return me;
}

/**
 * Who was in a call, read from the call itself.
 *
 * An instant coffee has no booking behind it — no accepted event, no meeting — so the
 * calendar feeds, which are the only thing that ever names a counterpart, cannot name
 * it, and a morning of them read as a column of identical "Coffee chat" rows. The room
 * still remembers who sat in it, so it is asked directly. Only the calls no booking
 * could name are fetched, and `call-state` is a read: unlike joining, it provisions
 * nothing for a call that is already over.
 */
function useRosterNames(ids: string[], me: string): Map<string, {name: string; image: string | null}> {
  const [names, setNames] = useState<Map<string, {name: string; image: string | null}>>(new Map());
  // Joined into a stable key so a re-render with the same calls does not refetch them.
  const key = ids.join(',');
  useEffect(() => {
    const wanted = key ? key.split(',') : [];
    if (!me || wanted.length === 0) return;
    const controller = new AbortController();
    let live = true;
    Promise.all(wanted.map(id =>
      api<CallState>(`${id}/call-state`, {signal: controller.signal}, 'call')
        .then(state => {
          const other = callCounterpart(state.participants, me);
          return other ? [id, {name: other.displayName, image: other.image ?? null}] as const : null;
        })
        // A call whose roster cannot be read keeps the generic title it had before.
        .catch(() => null)
    )).then(found => {
      if (!live) return;
      setNames(previous => {
        const next = new Map(previous);
        for (const entry of found) if (entry) next.set(entry[0], entry[1]);
        return next;
      });
    });
    return () => { live = false; controller.abort(); };
  }, [key, me]);
  return names;
}

/** One past call: the same card an upcoming one gets, with Notes in place of Join. */
function PastCall({call, workspaceId, who, roster}:{
  call: MyCall; workspaceId: string; who?: UpcomingMeeting; roster?: {name: string; image: string | null};
}) {
  const minutes = minutesBetween(call.startsAt, call.endedAt);
  // The booking names who it was arranged with; the roster, who actually sat in the
  // room. Either is a name, and an instant coffee only ever has the second.
  const counterpart = who?.counterpart ?? roster?.name ?? null;
  /**
   * Whose call it was, said in the title.
   *
   * `/group-calls/mine` titles a one-to-one chat "Coffee chat" and names nobody, so a
   * history of them was a column of identical rows. The accepted-events feed knows the
   * counterpart, so the person is put where the title and the avatar are.
   */
  const generic = !call.title || call.title.toLowerCase() === 'coffee chat';
  const title = generic && counterpart
    ? `Coffee chat with ${counterpart}`
    : call.title || 'Coffee chat';
  const lines: MeetingLine[] = [
    {glyph:'▤', text: dayLabel(call.startsAt ?? call.createdAt)},
    // Said plainly rather than shown as a duration of zero: nobody ended it.
    {glyph:'◷', text: minutes ? `${minutes} min` : callFinished(call) ? 'Length unknown' : 'No recorded end'},
    {glyph:'◉', text: call.kind === 'EVENT' ? 'Group call' : 'Coffee chat'},
  ];
  if (counterpart && !title.includes(counterpart)) lines.push({glyph:'◍', text: counterpart});

  return <MeetingCard person={{name: counterpart || title, image: who?.image ?? roster?.image ?? null}}
    title={title} lines={lines}
    /* Read-only, and a page of its own. Opening `/calls/:id` here would flash the live
       call surface and go near join, which provisions a room for a call that is over. */
    action={<Link className="up-join" href={`/app/${workspaceId}/calls/${call.id}`}>
      <span className="up-join-inner"><span aria-hidden="true">▤</span>Notes</span>
    </Link>} />;
}

export default function Schedule({workspaceId}:{workspaceId:string}) {
  /**
   * One feed backs this page, and it is the same one the phone reads: the accepted
   * coffee chats, ahead and behind. It is not workspace-scoped, so a chat booked from
   * someone's phone, or booked into another workspace, is on this calendar too.
   *
   * The workspace meetings list is deliberately not read here. It is workspace-scoped
   * and its rows name nobody, so building the calendar on it hid half of someone's
   * coffees and left the rest anonymous. It still backs the meeting record page.
   */
  const calls = useRows<AppCall>(`workspaces/${workspaceId}/upcoming-calls`);
  const history = useRows<MyCall>('mine', 'call');
  /**
   * The accepted coffee chats that have already happened.
   *
   * `upcoming-calls` is the backend's type 1, which holds only what is still ahead, so a
   * chat dropped off the calendar the moment it finished — the day it happened on went
   * blank. The history feed is what keeps it on the month, and it is also the only place
   * a finished call is told who it was with.
   */
  const pastEvents = useRows<AppCall>(`workspaces/${workspaceId}/past-calls`);
  // Recomputed on the minute so a meeting drops off the list once it has ended.
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  /**
   * The grid shows the whole month, the list below it only what can still be joined.
   * Filtering the grid to the future too emptied today's cell the moment a meeting
   * ended — including a stuck one the Inbox was still asking someone to deal with.
   */
  const rows = useMemo(() => coffees([...(calls.rows ?? []), ...(pastEvents.rows ?? [])]),
    [calls.rows, pastEvents.rows]);
  /**
   * History comes from the call itself, never from the calendar: an accepted event is a
   * booking between two people against one availability slot, so it has no participants
   * and a group call never produces one.
   */
  /**
   * A call counts as past once it has been ended *or* its start has gone by.
   *
   * Only the host ending the structured portion sets `endedAt`, and plenty of calls
   * simply run out — everyone leaves, nobody presses End. Those were being filtered out
   * of this list entirely, so a call that had plainly happened was nowhere to be found
   * and its notes were unreachable. A start in the past is enough to list it.
   */
  const past = (history.rows ?? [])
    .filter(row => callFinished(row) || (row.startsAt ? Date.parse(row.startsAt) < tick : false))
    .sort((a, b) => (Date.parse(b.startsAt ?? b.createdAt ?? '') || 0) - (Date.parse(a.startsAt ?? a.createdAt ?? '') || 0));

  /**
   * Who each finished call was with, looked up by the room it was held in and, failing
   * that, by the meeting it came from. Both the history feed and the upcoming one are
   * searched: a call that has only just ended can still be sitting in either.
   */
  const byCall = useMemo(() => {
    const found = new Map<string, UpcomingMeeting>();
    for (const event of rows) {
      if (!event.counterpart) continue;
      if (event.groupCallId && !found.has(event.groupCallId)) found.set(event.groupCallId, event);
      if (event.meetingId && !found.has(event.meetingId)) found.set(event.meetingId, event);
    }
    return found;
  }, [rows]);
  const whoWasOn = (call: MyCall) => byCall.get(call.id) ?? (call.meetingId ? byCall.get(call.meetingId) : undefined);

  /**
   * The finished calls no booking could name, asked of the rooms themselves. Restricted
   * to those, so a history that is fully named costs no extra requests at all.
   */
  const me = useMyId();
  const unnamed = useMemo(
    () => past.filter(call => !whoWasOn(call)).map(call => call.id).sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [past.map(call => call.id).join(','), byCall]);
  const roster = useRosterNames(unnamed, me);

  const booked = useMemo(() => {
    /**
     * A call that ran but never showed up in either calendar feed — an instant coffee,
     * or one whose accepted event has aged out — still happened on a day, so it belongs
     * on the month. Its room is the only thing it carries, and that is enough to open.
     */
    const seen = new Set(rows.flatMap(row => [row.groupCallId, row.meetingId].filter(Boolean) as string[]));
    const orphans = (history.rows ?? [])
      .filter(row => row.startsAt && !seen.has(row.id) && !(row.meetingId && seen.has(row.meetingId)))
      .map(row => ({
        key: `room:${row.id}`,
        title: row.title || 'Coffee chat',
        // Named from the room's own roster when no booking could name it.
        counterpart: roster.get(row.id)?.name ?? null,
        image: roster.get(row.id)?.image ?? null,
        startsAt: row.startsAt, endsAt: row.endedAt,
        where: row.kind === 'EVENT' ? 'Group call' : 'Caffriend call',
        status: null, notes: null,
        href: null, external: false, needsPayment: false,
        groupCallId: row.id, meetingId: row.meetingId,
        source: row.meetingId ? 'CRM' : null, // Orphan meetings with meetingId are likely CRM-originated
      } satisfies UpcomingMeeting));
    /**
     * Nobody is named from the CRM here any more. The feed hydrates both sides of every
     * coffee, so the person is already on the row — and looking them up through the
     * workspace's engagements could only ever name the ones this workspace knew about.
     */
    return [...rows, ...orphans]
      .sort((a, b) => (Date.parse(a.startsAt ?? '') || 0) - (Date.parse(b.startsAt ?? '') || 0));
  }, [rows, history.rows, roster]);
  const upcoming = useMemo(() => booked.filter(row => stillAhead(row, tick)), [booked, tick]);


  /**
   * The month draws as soon as any one feed answers. Waiting for all three would hold an
   * otherwise complete calendar behind whichever is slowest, and one that never answers
   * would hold it forever.
   */
  const ready = Boolean(calls.rows || pastEvents.rows || history.rows);

  return <>
    <Section title="Meetings" intro="Every call you have booked or held, on a calendar. Open one to join it or read what it produced." state={calls}>
      {calls.error && <p role="alert">Calls could not be loaded. <button className="secondary" onClick={calls.reload}>Try again</button></p>}
      {pastEvents.error && <p role="alert">Calls that have already happened could not be loaded. <button className="secondary" onClick={pastEvents.reload}>Try again</button></p>}
      {ready && <CallCalendar calls={booked} now={tick} workspaceId={workspaceId} />}
      {!ready && !calls.error && <p role="status">Loading your calendar…</p>}
      {ready && booked.length === 0 && <Empty>Nothing booked yet.</Empty>}
      {upcoming.length > 0 && <UpcomingMeetings meetings={upcoming} label="Upcoming meetings" />}
    </Section>

    <Section title="Past calls" intro="What each call produced — its notes, commitments and who was there." state={history}>
      {history.error && <p role="alert">Past calls could not be loaded. <button className="secondary" onClick={history.reload}>Try again</button></p>}
      {!history.rows && !history.error && <p role="status">Loading past calls…</p>}
      {history.rows && past.length === 0 && <Empty>No calls have finished yet.</Empty>}
      {past.length > 0 && <ul className="up-list" aria-label="Past calls">
        {past.map(call => <PastCall key={call.id} call={call} workspaceId={workspaceId} who={whoWasOn(call)} roster={roster.get(call.id)} />)}
      </ul>}
    </Section>
  </>;
}
