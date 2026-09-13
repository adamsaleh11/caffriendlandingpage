'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useRows, Section, Empty } from './common';
import type { AppCall } from '@/lib/app-projection';
import { callFinished, participantName, type CallState, type MyCall } from '@/lib/call';

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

function CallCalendar({calls}:{calls: AppCall[]}) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const today = new Date();
  const days = useMemo(() => monthGrid(month), [month]);
  const monthName = month.toLocaleDateString(undefined, {month:'long', year:'numeric'});
  const move = (by: number) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + by, 1));

  const forDay = (day: Date) => calls.filter(call =>
    call.startDate && sameDay(new Date(call.startDate), day));

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
          {onDay.map(call => <Link key={call.id} className="cal-event"
            href={call.groupCallId ? `/calls/${call.groupCallId}` : (call.joinUrl ?? '#')}>
            <span className="cal-event-time">{timeLabel(call.startDate)}</span>
            <span className="cal-event-who">{call.counterpart || call.purpose || 'Coffee chat'}</span>
          </Link>)}
        </div>;
      })}
    </div>
  </div>;
}

/**
 * One past call, opened in place.
 *
 * The listing endpoint gives the call but not who was in it, so the detail is fetched
 * once, when someone asks for it, rather than N times to render the list.
 */
function PastCall({call, me}:{call: MyCall; me: string}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<CallState>();
  const [problem, setProblem] = useState('');

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || detail) return;
    setProblem('');
    try { setDetail(await api<CallState>(`${call.id}/call-state`, {}, 'call')); }
    catch (failure) { setProblem(failure instanceof Error ? failure.message : 'That call could not be loaded.'); }
  }

  const minutes = minutesBetween(call.startsAt, call.endedAt);
  const others = (detail?.participants ?? []).filter(row => row.userId !== me);

  return <li className="past-call">
    <div className="past-call-row">
      <button className="past-call-open" aria-expanded={open} onClick={toggle}>
        <span className="past-call-title">{call.title || 'Coffee chat'}</span>
        <span className="past-call-meta">
          {dayLabel(call.startsAt ?? call.createdAt)}
          {minutes ? ` · ${minutes} min` : ''}
          {call.kind === 'EVENT' ? ' · group call' : ' · coffee chat'}
        </span>
      </button>
      {/* Read-only. Opening a finished call must never go through join, which would
          provision a LiveKit room for a call that is over. */}
      <Link className="button" href={`/calls/${call.id}`}>Open notes</Link>
    </div>

    {open && <div className="past-call-detail">
      {problem && <p role="alert">{problem}</p>}
      {!detail && !problem && <p role="status">Loading the call…</p>}
      {detail && <>
        <div className="past-call-people">
          <h4>Who was there</h4>
          <ul aria-label="People on this call">
            {detail.participants.map(person => <li key={person.id}>
              <span className="past-call-person">{participantName(person, me)}</span>
              <span className="past-call-person-meta">
                {[person.jobTitle, person.company].filter(Boolean).join(' · ')}
                {person.role === 'host' ? ' · Host' : person.role === 'co_host' ? ' · Co-host' : ''}
              </span>
            </li>)}
          </ul>
          {others.length === 1 && others[0].userId &&
            <Link className="past-call-profile" href={`/connections`}>See {others[0].displayName} in Connections</Link>}
        </div>
        <dl className="past-call-counts">
          <div><dt>Notes</dt><dd>{detail.notes.length}</dd></div>
          <div><dt>Commitments</dt><dd>{detail.actionItems.filter(item => !item.done).length} open</dd></div>
          <div><dt>Messages</dt><dd>{detail.chat.messages.length}</dd></div>
          <div><dt>Agenda</dt><dd>{detail.agendaBlocks.length} blocks</dd></div>
        </dl>
      </>}
    </div>}
  </li>;
}

export default function Schedule({workspaceId}:{workspaceId:string}) {
  const calls = useRows<AppCall>(`workspaces/${workspaceId}/upcoming-calls`);
  const history = useRows<MyCall>('mine', 'call');
  // Only used to name the viewer as "You" on a past call's roster.
  const [me, setMe] = useState('');
  useEffect(() => {
    let live = true;
    api<{id?:string}>('me', {}, 'app')
      .then(profile => { if (live && profile?.id) setMe(profile.id); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const upcoming = (calls.rows ?? [])
    .filter(row => row.startDate)
    .sort((a, b) => (Date.parse(a.startDate ?? '') || 0) - (Date.parse(b.startDate ?? '') || 0));

  /**
   * History comes from the call itself, never from the calendar: an accepted event is a
   * booking between two people against one availability slot, so it has no participants
   * and a group call never produces one.
   */
  const past = (history.rows ?? []).filter(callFinished)
    .sort((a, b) => (Date.parse(b.startsAt ?? b.createdAt ?? '') || 0) - (Date.parse(a.startsAt ?? a.createdAt ?? '') || 0));

  return <>
    <Section title="Upcoming calls" intro="Everything you have booked, on a calendar. Open one to join it." state={calls}>
      {calls.error && <p role="alert">Calls could not be loaded. <button className="secondary" onClick={calls.reload}>Try again</button></p>}
      {!calls.rows && !calls.error && <p role="status">Loading your calendar…</p>}
      {calls.rows && <CallCalendar calls={upcoming} />}
      {calls.rows && upcoming.length === 0 && <Empty>Nothing booked yet.</Empty>}
    </Section>

    <Section title="Past calls" intro="What each call produced — its notes, commitments and who was there." state={history}>
      {history.error && <p role="alert">Past calls could not be loaded. <button className="secondary" onClick={history.reload}>Try again</button></p>}
      {!history.rows && !history.error && <p role="status">Loading past calls…</p>}
      {history.rows && past.length === 0 && <Empty>No calls have finished yet.</Empty>}
      {past.length > 0 && <ul className="past-call-list" aria-label="Past calls">
        {past.map(call => <PastCall key={call.id} call={call} me={me} />)}
      </ul>}
    </Section>
  </>;
}
