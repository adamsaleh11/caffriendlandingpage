'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { calendarFailed, joinable, statusLabels, type AuditEvent, type Meeting } from '@/lib/contracts';
import StateCard from './StateCard';
import JoinAction from '@/components/app/JoinAction';
import { fromMeeting } from '@/lib/upcoming';
import {DateTimePicker} from '@/components/ui/date-time-picker';

const when = (value: string, timezone: string) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'Time unavailable';
  try { return new Intl.DateTimeFormat('en', {dateStyle:'long', timeStyle:'short', timeZone:timezone}).format(parsed); }
  catch { return new Intl.DateTimeFormat('en', {dateStyle:'long', timeStyle:'short', timeZone:'UTC'}).format(parsed); }
};
/** A local datetime-input value carries no offset, so the meeting's own zone supplies one. */
function zoned(local: string, timezone: string) {
  const naive = new Date(`${local}:00Z`);
  if (!Number.isFinite(naive.getTime())) return null;
  const shown = new Date(new Intl.DateTimeFormat('en-US', {timeZone:timezone, hour12:false,
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'}).format(naive).replace(/(\d+)\/(\d+)\/(\d+), (\d+)/, '$3-$1-$2T$4') + 'Z');
  return new Date(naive.getTime() * 2 - shown.getTime()).toISOString();
}

export default function MeetingPage({workspaceId, meetingId}:{workspaceId:string; meetingId:string}) {
  const [meeting, setMeeting] = useState<Meeting>();
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<ApiError>();
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [problem, setProblem] = useState('');
  const [dialog, setDialog] = useState<'reschedule'|'cancel'>();
  const [pending, setPending] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const opener = useRef<HTMLButtonElement>(null);
  const base = `workspaces/${workspaceId}/meetings/${meetingId}`;

  useEffect(() => {
    const controller = new AbortController();
    api<Meeting>(base, {signal:controller.signal})
      .then(row => { if (!controller.signal.aborted) setMeeting(row); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof ApiError ? failure : new ApiError(503,'This meeting is unavailable right now.')); });
    // Audit history is supporting detail: its absence must not hide the meeting.
    api<AuditEvent[]>(`${base}/audit`, {signal:controller.signal})
      .then(rows => { if (!controller.signal.aborted) setAudit(rows); })
      .catch(() => {});
    return () => controller.abort();
  }, [base, attempt]);

  const close = useCallback(() => { setDialog(undefined); opener.current?.focus(); }, []);
  useEffect(() => {
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, close]);

  if (error) return <div className="crm center"><StateCard
    title={error.status === 404 ? 'Meeting unavailable' : error.status === 403 ? 'Access unavailable' : 'Unable to load this meeting'}
    message={error.message} retry={error.status === 404 || error.status === 403 ? undefined : () => {setError(undefined); setMeeting(undefined); setAttempt(value => value + 1);}}/></div>;
  if (!meeting) return <div className="crm center"><p role="status">Loading meeting…</p></div>;

  const refresh = () => setAttempt(value => value + 1);

  async function copyLink() {
    setNotice(''); setProblem('');
    try {
      const {joinUrl} = await api<{joinUrl:string}>(`${base}/join-link`, {method:'POST'});
      await navigator.clipboard.writeText(joinUrl);
      setNotice('Invite link copied to your clipboard.');
    } catch (failure) {
      setProblem(failure instanceof ApiError ? failure.message : 'The invite link could not be copied. Try again.');
    }
  }

  /**
   * Asks for the calendar event again. The meeting itself never needed it: the call is
   * joinable either way, and this is only about the invitation landing in an inbox.
   */
  async function retryCalendar() {
    setNotice(''); setProblem(''); setRetrying(true);
    try {
      await api<Meeting>(`${base}/retry`, {method:'POST', body:'{}'});
      setNotice('Asking the calendar again. The call was joinable throughout.');
      refresh();
    } catch (failure) {
      setProblem(failure instanceof ApiError ? failure.message : 'The calendar event could not be retried.');
    } finally { setRetrying(false); }
  }

  async function reschedule() {
    const previous = meeting!;
    const startsAt = zoned(start, previous.timezone);
    const endsAt = zoned(end, previous.timezone);
    if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) {
      setProblem('Choose a start and an end, with the end after the start.'); return;
    }
    setPending(true); setNotice(''); setProblem('');
    // Shown optimistically, then reconciled with whatever the server actually returns.
    setMeeting({...previous, startsAt, endsAt});
    try {
      const updated = await api<Meeting>(`${base}/reschedule`, {method:'POST', body:JSON.stringify({startsAt, endsAt, timezone:previous.timezone})});
      setMeeting(updated); setNotice('Meeting rescheduled.'); setDialog(undefined);
    } catch (failure) {
      setMeeting(previous);
      setProblem(failure instanceof ApiError
        ? `This meeting could not be rescheduled. ${failure.message}`
        : 'This meeting could not be rescheduled. Its time is unchanged.');
      refresh();
    } finally { setPending(false); }
  }

  async function cancel() {
    setPending(true); setNotice(''); setProblem('');
    try {
      const updated = await api<Meeting>(`${base}/cancel`, {method:'POST'});
      setMeeting(updated);
      // A 200 can still carry a failure status; only CANCELLED is a cancellation.
      if (updated.status === 'CANCELLED') { setNotice('Meeting cancelled.'); setDialog(undefined); }
      else { setProblem('This meeting could not be cancelled. The calendar still holds it — try again.'); setDialog(undefined); }
    } catch (failure) {
      setProblem(failure instanceof ApiError
        ? `This meeting could not be cancelled. ${failure.message}`
        : 'This meeting could not be cancelled. Try again.');
      setDialog(undefined); refresh();
    } finally { setPending(false); }
  }

  const cancelled = meeting.status === 'CANCELLED';
  return <main className="crm center">
    <section className="card meeting-detail">
      <p className="eyebrow">MEETING</p>
      <h1>{meeting.purpose || 'Untitled meeting'}</h1>
      <p><strong>{statusLabels[meeting.status]}</strong></p>
      <dl>
        <dt>Starts</dt><dd>{when(meeting.startsAt, meeting.timezone)}</dd>
        <dt>Ends</dt><dd>{when(meeting.endsAt, meeting.timezone)}</dd>
        <dt>Timezone</dt><dd>{meeting.timezone}</dd>
        {meeting.source && <><dt>Source</dt><dd>{meeting.source === 'CRM' ? 'Desktop' : 'Mobile'}</dd></>}
        {meeting.venue && <><dt>Venue</dt><dd>{meeting.venue === 'CAFFRIEND_LIVEKIT' ? 'Caffriend call' : meeting.venue === 'PROVIDER_CONFERENCE' ? (meeting.provider === 'MICROSOFT' ? 'Microsoft Teams' : 'Google Meet') : meeting.venue === 'IN_PERSON' ? 'In person' : meeting.venue}</dd></>}
        {meeting.agenda && <><dt>Agenda</dt><dd>{meeting.agenda}</dd></>}
        {meeting.physicalLocation && <><dt>Location</dt><dd>{meeting.physicalLocation}</dd></>}
      </dl>
      {/*
        A failed calendar event is not a failed meeting, and is not reported as one. The
        call above is joinable; what could not be done is put in an inbox.
      */}
      {calendarFailed(meeting.status) && <div className="connection-gate" role="status">
        <strong>The call is booked — only its calendar invitation failed</strong>
        <p>Everyone can still join from here. {meeting.errorCode ? `The calendar reported: ${meeting.errorCode}.` : ''} You can ask the calendar again.</p>
        <button type="button" disabled={retrying} onClick={retryCalendar}>
          {retrying ? 'Asking the calendar…' : 'Retry calendar invitation'}</button>
      </div>}
      {meeting.errorCode && !calendarFailed(meeting.status) && <p role="alert">The calendar reported: {meeting.errorCode}</p>}

      {notice && <p role="status">{notice}</p>}
      {problem && <p role="alert">{problem}</p>}

      <div className="meeting-actions">
        {/* One control decides this, the same one the cards and the month calendar use:
            where Join goes, whether the door is open yet, and what to say when the
            booking has no room. This page used to answer all three by itself and let
            someone in days early while the other two refused. */}
        {joinable(meeting.status) && meeting.venue === 'IN_PERSON'
          ? <span className="text-link" style={{color: '#666', cursor: 'default'}}>In person</span>
          : joinable(meeting.status) &&
            <JoinAction meeting={fromMeeting(meeting)} label="Join on web" className="text-link" />}
        <button onClick={copyLink} disabled={cancelled}>Copy invite link</button>
        <button ref={dialog === 'reschedule' ? opener : undefined} disabled={cancelled}
          onClick={event => {opener.current = event.currentTarget; setStart(''); setEnd(''); setProblem(''); setDialog('reschedule');}}>Reschedule</button>
        <button className="secondary" disabled={cancelled}
          onClick={event => {opener.current = event.currentTarget; setProblem(''); setDialog('cancel');}}>Cancel meeting</button>
      </div>

      {dialog === 'reschedule' && <div role="dialog" aria-modal="true" aria-label="Reschedule this meeting" className="meeting-dialog">
        <h2>Reschedule this meeting</h2>
        <p>Everyone invited is notified through {meeting.provider === 'MICROSOFT' ? 'Outlook' : 'Google'} Calendar. Times are in {meeting.timezone}.</p>
        <div className="field"><span className="field-label">New start</span><DateTimePicker aria-label="New start" value={start} onChange={setStart} required/></div>
        <div className="field"><span className="field-label">New end</span><DateTimePicker aria-label="New end" value={end} onChange={setEnd} required/></div>
        <button disabled={pending || !start || !end} onClick={reschedule}>{pending ? 'Rescheduling…' : 'Confirm reschedule'}</button>
        <button className="secondary" onClick={close}>Keep current time</button>
      </div>}

      {dialog === 'cancel' && <div role="dialog" aria-modal="true" aria-label="Cancel this meeting" className="meeting-dialog">
        <h2>Cancel this meeting?</h2>
        <p>This cannot be undone. Everyone invited is notified, and the invitation link stops working.</p>
        <button disabled={pending} onClick={cancel}>{pending ? 'Cancelling…' : 'Confirm cancellation'}</button>
        <button className="secondary" onClick={close}>Keep meeting</button>
      </div>}

      <h2>Activity</h2>
      {audit.length
        ? <ul className="meeting-audit">{audit.map(row =>
            <li key={row.id}><span>{row.action}</span> <span className="small">{when(row.createdAt, meeting.timezone)} · {row.actorType.toLowerCase()}</span></li>)}</ul>
        : <p className="small">No recorded activity is available for this meeting.</p>}

      {/* Attendees and the provider event are not in the backend's meeting projection. */}
      <p className="small">Attendee details and the calendar event are managed in {meeting.provider === 'MICROSOFT' ? 'Outlook' : 'Google'} Calendar.</p>
      <Link href={`/app/${workspaceId}/calendar`} className="text-link">Back to Calendar</Link>
    </section>
  </main>;
}
