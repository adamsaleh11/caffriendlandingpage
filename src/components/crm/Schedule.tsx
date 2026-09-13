'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api, ApiError } from '@/lib/api';
import { isLiveConnection, providerNames, statusLabels, type CalendarConnection, type CalendarOption, type Engagement, type Meeting, type Person } from '@/lib/contracts';
import { useKeys, useList, useRows, Section, Empty, More } from './common';
import { useLiveRows } from './record-actions';
import type { AppCall } from '@/lib/app-projection';
import {FormSelect} from '@/components/ui/form-select';
import {DatePicker} from '@/components/ui/date-picker';
import {TimePicker} from '@/components/ui/time-picker';

type Busy = { busy: {start:string; end:string}[] };
const hour = 3600000;

/** The viewer's own zone is the honest default; every other IANA zone stays selectable. */
const zones = (): string[] => {
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const common = ['UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Berlin','Asia/Kolkata','Asia/Singapore','Australia/Sydney'];
  return [local, ...common.filter(zone => zone !== local)];
};

export default function Schedule({workspaceId}:{workspaceId:string}) {
  const meetings = useList<Meeting>(`workspaces/${workspaceId}/meetings`);
  const calls = useRows<AppCall>(`workspaces/${workspaceId}/upcoming-calls`);
  const engagements=useLiveRows(useList<Engagement>(`workspaces/${workspaceId}/crm/engagements`));
  const people=useLiveRows(useList<Person>(`workspaces/${workspaceId}/crm/people`));
  const connections = useRows<CalendarConnection>(`workspaces/${workspaceId}/calendar-connections`);

  const [connectionId, setConnectionId] = useState('');
  const [calendars, setCalendars] = useState<CalendarOption[] | 'error'>();
  const [busy, setBusy] = useState<Busy['busy']>();
  const [draft, setDraft] = useState<Record<string,string>>();
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState('');
  const [cancelling, setCancelling] = useState<string>();
  /** Unset until the organizer chooses, so the capability answer can arrive late without overriding them. */
  const [conference, setConference] = useState<'yes'|'no'>();
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const keyFor = useKeys();

  const usable = (connections.rows ?? []).filter(row => isLiveConnection(row.status));
  const connection = usable.find(row => row.id === connectionId) ?? usable[0];
  const calendar = calendars !== 'error' ? (calendars ?? []).find(row => row.id === connection?.calendarId) : undefined;
  const canConference = calendar?.supportsConference === true;

  useEffect(() => {
    if (!connection) return;
    setCalendars(undefined);
    api<CalendarOption[]>(`workspaces/${workspaceId}/calendar-connections/${connection.id}/calendars`)
      .then(result => setCalendars(Array.isArray(result) ? result : []))
      .catch(() => setCalendars('error'));
  }, [workspaceId, connection]);

  /** Busy intervals only. Titles and attendees of unrelated events are never requested. */
  async function loadBusy(from: string, zone: string) {
    if (!connection) return;
    const start = new Date(`${from}T00:00:00`);
    if (!Number.isFinite(start.getTime())) return;
    const end = new Date(start.getTime() + 7 * 24 * hour);
    try {
      const result = await api<Busy>(`workspaces/${workspaceId}/calendar-connections/${connection.id}/availability?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`);
      setBusy(result.busy);
    } catch { setBusy(undefined); setProblem(`Availability for ${zone} could not be loaded, so busy times are not shown. You can still choose a time.`); }
  }

  const overlapsBusy = (startsAt: string, endsAt: string) =>
    (busy ?? []).some(slot => Date.parse(startsAt) < Date.parse(slot.end) && Date.parse(endsAt) > Date.parse(slot.start));

  async function confirm() {
    if (!draft) return;
    setWorking('create'); setProblem(''); setNotice('');
    const body: Record<string, unknown> = {
      purpose: draft.purpose,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      timezone: draft.timezone,
      attendees: draft.attendees ? draft.attendees.split(',').map(value => value.trim()).filter(Boolean) : [],
      conference: draft.conference === 'yes',
      engagementId: draft.engagementId,
    };
    if (draft.conference === 'yes') body.connectionId = connection?.id;
    else body.physicalLocation = draft.physicalLocation;
    try {
      await api<Meeting>(`workspaces/${workspaceId}/meetings`, {
        method:'POST', body: JSON.stringify(body),
        headers:{'X-Idempotency-Key': keyFor(`meeting:${JSON.stringify(body)}`)},
      });
      setDraft(undefined); setNotice('The invitation was sent to your calendar provider. Its status is shown below.');
      meetings.reload();
    } catch (error) {
      // A failed create is unconfirmed, never a silent success: reconcile with the server.
      setProblem(error instanceof ApiError ? error.message : 'The meeting was not created. Nothing was sent.');
      meetings.reload();
    } finally { setWorking(''); }
  }

  async function act(meeting: Meeting, what: 'retry'|'cancel') {
    setWorking(meeting.id); setProblem(''); setNotice('');
    const path = what === 'retry' ? `workspaces/${workspaceId}/meetings/${meeting.id}/retry` : `workspaces/${workspaceId}/meetings/${meeting.id}/cancel`;
    try {
      await api(path, {method:'POST', body:'{}', headers:{'X-Idempotency-Key': keyFor(`${what}:${meeting.id}`)}});
      setNotice(what === 'retry' ? 'Caffriend is trying the calendar provider again.' : 'Cancellation was sent to your calendar provider.');
      setCancelling(undefined); meetings.reload();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That did not complete. The status below is the server’s.');
      meetings.reload();
    } finally { setWorking(''); }
  }

  const personName = (engagementId?: string | null) => {
    const engagement = (engagements.rows ?? []).find(row => row.id === engagementId);
    const person = (people.rows ?? []).find(row => row.id === engagement?.personId);
    return person?.displayName;
  };

  return <>
    <Section title="Meetings" intro="Your booked coffee chats, using the same meeting data as Upcoming Calls." state={calls}>
      {!calls.rows && !calls.error && <p role="status">Loading meetings…</p>}
      {calls.error && <p role="alert">Meetings could not be loaded. <button className="secondary" onClick={calls.reload}>Try again</button></p>}
      {calls.rows?.length===0&&<Empty>No meetings yet.</Empty>}
      <ul className="meetings">{(calls.rows??[]).map(call=><li key={call.id}>
        <h3>{call.purpose||'Coffee chat'}</h3><dl>
          <dt>When</dt><dd>{call.startDate?`${new Date(call.startDate).toLocaleString()}${call.endDate?` – ${new Date(call.endDate).toLocaleTimeString()}`:''}`:'Not scheduled'}{call.timezone?` (${Intl.DateTimeFormat().resolvedOptions().timeZone})`:''}</dd>
          <dt>With</dt><dd className="counterpart">{call.image&&<Image className="avatar" src={call.image} alt="" width={32} height={32} unoptimized/>}{call.counterpart||'Guest recipient'}</dd>
          <dt>Venue</dt><dd>{call.venue==='CAFFRIEND_LIVEKIT'?'Caffriend call':call.venue==='PROVIDER_CONFERENCE'?'Google Meet':call.physicalLocation||'In person'}</dd>
          {call.status&&<><dt>Status</dt><dd>{call.status.replace(/_/g,' ').toLowerCase()}</dd></>}
        </dl>{call.joinUrl&&<a className="button" href={call.joinUrl} target={call.venue==='PROVIDER_CONFERENCE'?'_blank':undefined} rel={call.venue==='PROVIDER_CONFERENCE'?'noreferrer noopener':undefined}>Join</a>}
      </li>)}</ul>
    </Section>

    <Section title="Calendar delivery" intro="Provider delivery and cancellation controls for meetings created in this workspace." state={meetings}>
      {notice && <p role="status" className="notice">{notice}</p>}
      {problem && <p role="alert">{problem}</p>}
      {(meetings.rows?.length ?? 0) === 0 && <Empty>No calendar delivery records.</Empty>}
      <ul className="meetings">{(meetings.rows ?? []).map(meeting => <li key={meeting.id}>
        <h3><Link href={`/app/${workspaceId}/meetings/${meeting.id}`}>{meeting.purpose}</Link></h3>
        <dl>
          <dt>When</dt><dd>{new Date(meeting.startsAt).toLocaleString()} – {new Date(meeting.endsAt).toLocaleTimeString()} ({meeting.timezone})</dd>
          <dt>With</dt><dd>{personName(meeting.engagementId) ?? 'Linked to an engagement'}</dd>
          <dt>Status</dt><dd>{statusLabels[meeting.status]}{meeting.errorCode ? ` — ${meeting.errorCode}` : ''}</dd>
          <dt>Where</dt><dd>{meeting.joinUrl
            ? <a href={meeting.joinUrl} target="_blank" rel="noreferrer noopener">Join link</a>
            : meeting.physicalLocation || 'No location recorded'}</dd>
        </dl>
        {(meeting.status === 'FAILED' || meeting.status === 'CANCEL_FAILED') && <button disabled={!!working} onClick={() => act(meeting, 'retry')}>{working === meeting.id ? 'Retrying…' : 'Try again'}</button>}
        {['CONFIRMED','PENDING','LOCAL'].includes(meeting.status) && (cancelling === meeting.id
          ? <div role="group" aria-label="Confirm cancellation" className="confirm">
              <p>Cancel this meeting? Caffriend asks your provider to cancel the invitation and notify the attendees.</p>
              <button disabled={!!working} onClick={() => act(meeting, 'cancel')}>{working === meeting.id ? 'Cancelling…' : 'Yes, cancel the meeting'}</button>
              <button className="secondary" onClick={() => setCancelling(undefined)}>Keep it</button>
            </div>
          : <button className="secondary" onClick={() => setCancelling(meeting.id)}>Cancel meeting</button>)}
      </li>)}</ul>
      <More state={meetings} />
    </Section>

    <section className="card">
      <h2>Schedule a meeting</h2>
      {!connections.rows && <p role="status">Checking your calendar connections…</p>}
      {connections.rows && usable.length === 0 && <p role="note">
        No calendar is connected, so meetings cannot be scheduled. Everything else in this workspace still works.{' '}
        <Link className="text-link" href={`/app/${workspaceId}/settings`}>Connect a calendar →</Link>
      </p>}

      {usable.length > 0 && !draft && <form onSubmit={event => { event.preventDefault();
        const data = new FormData(event.currentTarget);
        const values = Object.fromEntries([...data.entries()].map(([k, v]) => [k, String(v)]));
        const startsAt = new Date(`${values.date}T${values.time}`);
        if (!Number.isFinite(startsAt.getTime())) { setProblem('Choose a valid date and time.'); return; }
        const endsAt = new Date(startsAt.getTime() + Number(values.duration) * 60000);
        if (startsAt.getTime() <= Date.now()) { setProblem('Choose a time in the future.'); return; }
        if (values.conference === 'no' && !values.physicalLocation.trim()) { setProblem('Give a location, or choose an online conference.'); return; }
        setProblem('');
        setDraft({...values, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString()});
      }}>
        <div className="field">
          <span className="field-label">Calendar to use</span>
          <FormSelect aria-label="Calendar to use" value={connection?.id ?? ''} onValueChange={setConnectionId}
            options={usable.map(row => ({value:row.id,label:`${providerNames[row.provider]} — ${row.calendarName || row.calendarId}`}))} />
        </div>
        <div className="field">
          <span className="field-label">Engagement</span>
          <FormSelect name="engagementId" required aria-label="Engagement" placeholder="Choose the engagement this meeting belongs to"
            options={(engagements.rows ?? []).map(row => ({value:row.id,label:`${row.objective}${personName(row.id) ? ` — ${personName(row.id)}` : ''}`}))} />
        </div>
        <label>Purpose<input name="purpose" required maxLength={2000} /></label>
        <label>Attendee emails<input name="attendees" placeholder="name@example.com, other@example.com" /><span className="small">Separate with commas. Everyone listed receives one invitation.</span></label>
        <div className="field"><span className="field-label">Date</span>
          <DatePicker name="date" required aria-label="Date" value={meetingDate}
            onChange={date => { setMeetingDate(date); loadBusy(date, Intl.DateTimeFormat().resolvedOptions().timeZone); }} />
        </div>
        <div className="field"><span className="field-label">Start time</span>
          <TimePicker name="time" required aria-label="Start time" value={meetingTime} onChange={setMeetingTime} />
        </div>
        <div className="field"><span className="field-label">Duration</span>
          <FormSelect name="duration" aria-label="Duration" defaultValue="30"
            options={[{value:'15',label:'15 minutes'},{value:'30',label:'30 minutes'},{value:'45',label:'45 minutes'},{value:'60',label:'1 hour'}]} />
        </div>
        <div className="field"><span className="field-label">Timezone</span>
          <FormSelect name="timezone" aria-label="Timezone" defaultValue={zones()[0]} options={zones().map(zone => ({value:zone,label:zone}))} />
        </div>
        <fieldset>
          <legend>Where will it happen?</legend>
          <label className="choice"><input type="radio" name="conference" value="yes" checked={(conference ?? (canConference ? 'yes' : 'no')) === 'yes'} disabled={!canConference} onChange={() => setConference('yes')} />
            {connection?.provider === 'GOOGLE' ? 'Google Meet' : 'Microsoft Teams'}
            <span className="small">{canConference
              ? 'Your provider creates the conference link with the invitation.'
              : `This calendar does not report ${connection?.provider === 'GOOGLE' ? 'Meet' : 'Teams'} support, so an online conference cannot be created on it.`}</span>
          </label>
          <label className="choice"><input type="radio" name="conference" value="no" checked={(conference ?? (canConference ? 'yes' : 'no')) === 'no'} onChange={() => setConference('no')} /> A physical location</label>
        </fieldset>
        <label>Location<input name="physicalLocation" maxLength={1000} /><span className="small">Used only when you chose a physical location.</span></label>
        {busy && <p className="small" role="status">{busy.length} busy period{busy.length === 1 ? '' : 's'} found in the week from your chosen date. Only busy times are read; Caffriend never sees what those events are.</p>}
        {calendars === 'error' && <p role="alert">This calendar’s conference capability could not be checked, so an online conference is not offered.</p>}
        <button>Review before sending</button>
      </form>}

      {draft && <div role="group" aria-label="Confirm this meeting" className="confirm">
        <h3>Send this invitation?</h3>
        <dl>
          <dt>Account</dt><dd>{connection?.accountIdentifier || 'Account identifier unavailable'}</dd>
          <dt>Calendar</dt><dd>{connection?.calendarName || connection?.calendarId} ({connection ? providerNames[connection.provider] : ''})</dd>
          <dt>Purpose</dt><dd>{draft.purpose}</dd>
          <dt>When</dt><dd>{new Date(draft.startsAt).toLocaleString()} – {new Date(draft.endsAt).toLocaleTimeString()}</dd>
          <dt>Timezone</dt><dd>{draft.timezone}</dd>
          <dt>Attendees</dt><dd>{draft.attendees?.trim() || 'No attendees — only your own calendar'}</dd>
          <dt>Conference</dt><dd>{draft.conference === 'yes' ? (connection?.provider === 'GOOGLE' ? 'A Google Meet link is created by Google' : 'A Microsoft Teams link is created by Outlook') : draft.physicalLocation}</dd>
          <dt>Invitations</dt><dd>Your provider sends exactly one invitation to each attendee above. Caffriend does not email them separately.</dd>
        </dl>
        {overlapsBusy(draft.startsAt, draft.endsAt) && <p role="alert">This overlaps a busy period on the selected calendar. You can still send it.</p>}
        <button disabled={working === 'create'} onClick={confirm}>{working === 'create' ? 'Sending…' : 'Send the invitation'}</button>
        <button className="secondary" onClick={() => setDraft(undefined)}>Go back and change it</button>
      </div>}
    </section>
  </>;
}
