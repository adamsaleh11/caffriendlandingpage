'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, startCrmOAuth } from '@/lib/api';
import { bookingRequest, isLiveConnection, type CalendarConnection, type DesktopVenue, type Meeting, type Person } from '@/lib/contracts';
import Modal from './Modal';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Booking a coffee chat outright, rather than proposing times by email.
 *
 * A Caffriend call asks for nothing beyond a time: the server stopped requiring a
 * connected calendar for one, so no connection is loaded, requested or gated on unless
 * Google Meet is chosen. In person is not offered — it is not implemented.
 */

const zones = () => {
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return [local, ...['UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Berlin','Asia/Kolkata','Asia/Singapore','Australia/Sydney'].filter(zone => zone !== local)];
};

export default function BookCall({workspaceId, engagementId, person, initialPurpose, onClose, onBooked}:{
  workspaceId: string; engagementId: string; person?: Person; initialPurpose: string;
  onClose: () => void; onBooked: (meeting: Meeting) => void;
}) {
  const [purpose, setPurpose] = useState(initialPurpose);
  const [email, setEmail] = useState(person?.email ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [timezone, setTimezone] = useState(zones()[0]);
  const [venue, setVenue] = useState<DesktopVenue>('CAFFRIEND_LIVEKIT');
  const [connectionId, setConnectionId] = useState('');
  const [connections, setConnections] = useState<CalendarConnection[]>();
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState<'book'|'connect'>();
  /**
   * Held for the life of this form rather than minted per attempt: a retry after a
   * failure must replay the same booking, not book a second one.
   */
  const [key] = useState(() => crypto.randomUUID());

  // Loaded only when Google Meet is chosen. A Caffriend call never asks the question.
  useEffect(() => {
    if (venue !== 'PROVIDER_CONFERENCE' || connections) return;
    let active = true;
    api<CalendarConnection[]>(`workspaces/${workspaceId}/calendar-connections`)
      .then(rows => { if (active) setConnections(rows); })
      .catch(() => { if (active) setConnections([]); });
    return () => { active = false; };
  }, [venue, connections, workspaceId]);

  const google = (connections ?? []).filter(row => row.provider === 'GOOGLE' && isLiveConnection(row.status));
  const draft = useMemo(() => {
    const start = new Date(`${date}T${time}`);
    const valid = Number.isFinite(start.getTime());
    return bookingRequest({
      purpose, engagementId, timezone, venue,
      attendees: [email],
      startsAt: valid ? start.toISOString() : '',
      endsAt: valid ? new Date(start.getTime() + Number(duration) * 60000).toISOString() : '',
      ...(venue === 'PROVIDER_CONFERENCE' ? {connectionId} : {}),
    });
  }, [purpose, engagementId, timezone, venue, email, date, time, duration, connectionId]);

  async function book() {
    if (draft.problem) return;
    setBusy('book'); setProblem('');
    try {
      onBooked(await api<Meeting>(`workspaces/${workspaceId}/meetings`,
        {method:'POST', body: JSON.stringify(draft.value), headers:{'X-Idempotency-Key': key}}));
    } catch (error) {
      setProblem(error instanceof ApiError || error instanceof Error ? error.message : 'The call was not booked.');
    } finally { setBusy(undefined); }
  }

  async function connect() {
    setBusy('connect'); setProblem('');
    try { await startCrmOAuth(`/workspaces/${workspaceId}/calendar-connections/GOOGLE/connect`); }
    catch (error) { setProblem(error instanceof Error ? error.message : 'Google could not be connected.'); }
    finally { setBusy(undefined); }
  }

  return <Modal title="Book a coffee chat"
    description="This books the call outright. To propose times and let them choose, send an invitation instead."
    onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); book(); }}>
      <label>What is the call for
        <input value={purpose} required maxLength={200} onChange={event => setPurpose(event.target.value)} />
      </label>
      <label>Who is joining
        <input type="email" value={email} required onChange={event => setEmail(event.target.value)} />
      </label>
      <div className="field-row">
        <label>Date<DatePicker value={date} onChange={setDate} /></label>
        <label>Start<TimePicker value={time} onChange={setTime} /></label>
        <label>Length
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger aria-label="Length"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['15','30','45','60'].map(option =>
                <SelectItem key={option} value={option}>{option} minutes</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </div>
      <label>Times shown in
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger aria-label="Times shown in"><SelectValue /></SelectTrigger>
          <SelectContent>{zones().map(zone => <SelectItem key={zone} value={zone}>{zone}</SelectItem>)}</SelectContent>
        </Select>
      </label>

      <fieldset><legend>Where will the call happen?</legend>
        <label className="choice">
          <input type="radio" name="venue" checked={venue === 'CAFFRIEND_LIVEKIT'}
            onChange={() => setVenue('CAFFRIEND_LIVEKIT')} /> Caffriend call
        </label>
        <label className="choice">
          <input type="radio" name="venue" checked={venue === 'PROVIDER_CONFERENCE'}
            onChange={() => setVenue('PROVIDER_CONFERENCE')} /> Google Meet
        </label>
        <p className="small">A Caffriend call needs no calendar connection.</p>
      </fieldset>

      {venue === 'PROVIDER_CONFERENCE' && <>
        {google.length
          ? <label>Google calendar
              <Select value={connectionId} onValueChange={setConnectionId}>
                <SelectTrigger aria-label="Google calendar"><SelectValue placeholder="Choose a calendar" /></SelectTrigger>
                <SelectContent>{google.map(row =>
                  <SelectItem key={row.id} value={row.id}>{row.accountIdentifier ?? row.calendarName ?? 'Google'}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          : <div className="connection-gate">
              <strong>Google Meet needs a connected Google calendar</strong>
              <p>Connect one, or book a Caffriend call instead — that needs nothing.</p>
              <button type="button" disabled={!!busy} onClick={connect}>Connect Google Calendar</button>
            </div>}
      </>}

      {problem && <p role="alert">{problem}</p>}
      {draft.problem && <p className="small">{draft.problem}</p>}
      <button disabled={!!busy || !!draft.problem}>{busy === 'book' ? 'Booking…' : 'Book the call'}</button>
    </form>
  </Modal>;
}
