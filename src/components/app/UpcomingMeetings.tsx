'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { type UpcomingMeeting } from '@/lib/upcoming';
import Face, { type FacePerson } from './Face';
import JoinAction from './JoinAction';

/**
 * Upcoming meetings, in the card the native app uses.
 *
 * The native `UpcomingMeetingCard` is a white card with the meeting on the left —
 * title, then a dated line and a timed line, each behind its own glyph — and one
 * orange Join pill on the right. The same shape is used here so the web and the
 * phone show a booked meeting the same way, on both the Meetings page and the
 * Upcoming calls page.
 */

const dayText = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, {weekday:'long', month:'short', day:'numeric'}) : 'Not scheduled';

const timeText = (start: string | null, end: string | null) => {
  if (!start) return 'Time pending';
  const clock = (value: string) => new Date(value).toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
  return end ? `${clock(start)} - ${clock(end)}` : clock(start);
};

/**
 * One clock for the whole list.
 *
 * Join opens five minutes before the start, so a card that is too early has to become
 * joinable on its own — nobody should have to reload the page at the top of the hour.
 */
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** One line of the card: a glyph, then what it says. */
export type MeetingLine = { glyph: string; text: string };

/**
 * The card itself, with whatever belongs on its right.
 *
 * An upcoming call and a finished one are the same object a day apart, so they are the
 * same card: only the action differs — Join before, Notes after. `detail` is anything
 * that expands underneath, which is how a past call shows who was there.
 */
export function MeetingCard({person, title, status, lines, notes, action, detail}:{
  person: FacePerson;
  title: string;
  status?: string | null;
  lines: MeetingLine[];
  notes?: string | null;
  action: ReactNode;
  detail?: ReactNode;
}) {
  return <li className="up-card">
    <div className="up-row">
      <div className="up-main">
        <div className="up-head">
          <Face person={person} />
          <h3 className="up-title">{title}</h3>
          {status && <span className="up-status">{status}</span>}
        </div>
        {lines.map(line => <p className="up-meta" key={`${line.glyph}${line.text}`}>
          <span className="up-glyph" aria-hidden="true">{line.glyph}</span>{line.text}
        </p>)}
        {notes && <p className="up-notes">{notes}</p>}
      </div>
      {action}
    </div>
    {detail}
  </li>;
}

export function UpcomingMeetingCard({meeting, now}:{meeting:UpcomingMeeting; now:number}) {
  const lines: MeetingLine[] = [
    {glyph:'▤', text: dayText(meeting.startsAt)},
    {glyph:'◷', text: timeText(meeting.startsAt, meeting.endsAt)},
  ];
  if (meeting.where) lines.push({glyph:'◉', text: meeting.where});
  if (meeting.counterpart && meeting.title !== `Meeting with ${meeting.counterpart}`)
    lines.push({glyph:'◍', text: meeting.counterpart});
  return <MeetingCard
    person={{name: meeting.counterpart || meeting.title, image: meeting.image}}
    title={meeting.title} status={meeting.status} lines={lines} notes={meeting.notes}
    action={<JoinAction meeting={meeting} now={now} />} />;
}

export default function UpcomingMeetings({meetings, label = 'Upcoming meetings'}:{meetings:UpcomingMeeting[]; label?:string}) {
  const now = useNow();
  return <ul className="up-list" aria-label={label}>
    {meetings.map(meeting => <UpcomingMeetingCard key={meeting.key} meeting={meeting} now={now} />)}
  </ul>;
}
