'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type { AppCall } from '@/lib/app-projection';
import { fromCall } from '@/lib/upcoming';
import { callCounterpart, participantName, type CallNote, type CallState, type MyCall, type NoteScope } from '@/lib/call';
import { useRows, Section, Empty } from './common';
import StateCard from './StateCard';

/**
 * What a coffee chat left behind, as a page of its own.
 *
 * Reading the notes used to mean opening `/calls/:id` — the live call surface, with its
 * tiles, dock and device prompts — for a call that was long over. This reads the call's
 * state and nothing that could provision a room, so what was said, agreed and written
 * down stays readable for as long as it is useful.
 */

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('');

const noteScopes: {key: NoteScope; title: string; intro: string}[] = [
  {key:'shared', title:'Shared notes', intro:'Written for everyone who was on the call.'},
  {key:'private', title:'Your private notes', intro:'Only you can see these.'},
  {key:'ai', title:'AI notes', intro:'Taken automatically during the call.'},
];

const stamp = (value: string | null) =>
  value ? new Date(value).toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) : '';
const dayLabel = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric', year:'numeric'}) : 'Date unknown';
const minutesBetween = (from: string | null, to: string | null) => {
  if (!from || !to) return null;
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 60000);
  return Number.isFinite(span) && span > 0 ? span : null;
};

function Notes({rows, title, intro}:{rows: CallNote[]; title: string; intro: string}) {
  if (!rows.length) return null;
  return <section className="card">
    <h1>{title}</h1>
    <p>{intro}</p>
    <ul className="note-grid" aria-label={title}>
      {rows.map(note => <li key={note.id} className="note-card">
        <p>{note.body}</p>
        {note.createdAt && <span className="small">{stamp(note.createdAt)}</span>}
      </li>)}
    </ul>
  </section>;
}

export default function CallNotes({workspaceId, callId}:{workspaceId:string; callId:string}) {
  const [detail, setDetail] = useState<CallState>();
  const [error, setError] = useState<ApiError>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(undefined);
    api<CallState>(`${callId}/call-state`, {signal:controller.signal}, 'call')
      .then(state => { if (!controller.signal.aborted) setDetail(state); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof ApiError ? failure : new ApiError(503, 'This call is unavailable right now.')); });
    return () => controller.abort();
  }, [callId, attempt]);

  // Supporting detail only: who the chat was with, and when it was booked for. Its
  // absence must never keep the notes off the screen.
  const mine = useRows<MyCall>('mine', 'call');
  const pastEvents = useRows<AppCall>(`workspaces/${workspaceId}/past-calls`);
  const [me, setMe] = useState('');
  useEffect(() => {
    let live = true;
    api<{id?:string}>('me', {}, 'app')
      .then(profile => { if (live && profile?.id) setMe(profile.id); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  if (error) return <div className="crm center"><StateCard
    title={error.status === 404 ? 'Call unavailable' : error.status === 403 ? 'Access unavailable' : 'Unable to load this call'}
    message={error.message}
    retry={error.status === 404 || error.status === 403 ? undefined : () => { setError(undefined); setDetail(undefined); setAttempt(value => value + 1); }} /></div>;
  if (!detail) return <section className="card"><h1>Call notes</h1><p role="status">Loading the call…</p></section>;

  const row = (mine.rows ?? []).find(call => call.id === callId);
  const booking = (pastEvents.rows ?? []).map(fromCall)
    .find(event => event.groupCallId === callId || (row?.meetingId && event.meetingId === row.meetingId));
  /**
   * Who it was with. The roster is who actually sat in the room, so it wins over the
   * booking, which only says who it was arranged with — a substitute, a no-show or an
   * extra person makes those two different, and the roster is the honest answer. The
   * booking still fills in when the viewer is not yet known or it was not one-to-one.
   */
  const other = me ? callCounterpart(detail.participants, me) : null;
  const counterpart = other?.displayName ?? booking?.counterpart ?? null;

  const generic = !row?.title || row.title.toLowerCase() === 'coffee chat';
  const title = generic && counterpart ? `Coffee chat with ${counterpart}` : row?.title || 'Coffee chat';

  const started = row?.startsAt ?? detail.room.startedAt;
  const minutes = minutesBetween(started, row?.endedAt ?? detail.room.endedAt);
  const openItems = detail.actionItems.filter(item => !item.done);

  const shared = detail.notes.filter(note => note.scope === 'shared');
  const nothing = detail.notes.length === 0 && detail.actionItems.length === 0 && detail.chat.messages.length === 0;

  return <>
    <section className="card call-notes-head">
      <div className="call-notes-identity">
        {booking?.image && counterpart === booking.counterpart
          // eslint-disable-next-line @next/next/no-img-element -- provider-hosted avatars are not a configured Next image domain
          ? <img className="avatar large" src={booking.image} alt="" width={72} height={72} />
          : <span className="avatar large" aria-hidden="true">{initials(counterpart || title)}</span>}
        <div>
          <p className="eyebrow">COFFEE CHAT</p>
          <h1>{title}</h1>
          <p>{dayLabel(started)}{minutes ? ` · ${minutes} min` : ''}{detail.room.kind === 'EVENT' ? ' · group call' : ''}</p>
        </div>
      </div>
      <dl className="call-notes-counts">
        <div><dt>Notes</dt><dd>{detail.notes.length}</dd></div>
        <div><dt>Open commitments</dt><dd>{openItems.length}</dd></div>
        <div><dt>Messages</dt><dd>{detail.chat.messages.length}</dd></div>
        <div><dt>Agenda blocks</dt><dd>{detail.agendaBlocks.length}</dd></div>
      </dl>
      <Link className="text-link" href={`/app/${workspaceId}/calendar`}>Back to Meetings</Link>
    </section>

    <Section title="Who was there" intro="Everyone seated in the room, and what they do." state={{rows:detail.participants, error:undefined, reload:()=>{}}}>
      {detail.participants.length === 0 ? <Empty>Nobody was recorded on this call.</Empty>
        : <ul className="people-grid" aria-label="People on this call">
            {detail.participants.map(person => <li key={person.id} className="person-card">
              <span className="person-card-link">
                <span className="avatar" aria-hidden="true">{initials(person.displayName)}</span>
                <span className="person-card-name">{participantName(person, me)}</span>
              </span>
              <p className="small person-card-role">
                {[person.jobTitle, person.company].filter(Boolean).join(' · ') || 'No role recorded'}
              </p>
              {person.role !== 'participant' &&
                <p className="small">{person.role === 'host' ? 'Host' : 'Co-host'}</p>}
            </li>)}
          </ul>}
      {/* One-to-one: the person is worth keeping hold of, so their record is one click. */}
      {other && counterpart &&
        <Link className="text-link" href="/connections">See {counterpart} in Connections</Link>}
    </Section>

    {nothing && <section className="card">
      <h1>Nothing was written down</h1>
      <p>This call finished without notes, commitments or chat. Anything captured next time shows up here.</p>
    </section>}

    {noteScopes.map(scope => <Notes key={scope.key} title={scope.title} intro={scope.intro}
      rows={scope.key === 'shared' ? shared : detail.notes.filter(note => note.scope === scope.key)} />)}

    {detail.actionItems.length > 0 && <section className="card">
      <h1>Commitments</h1>
      <p>{openItems.length === 0 ? 'Everything agreed here is done.' : `${openItems.length} still open.`}</p>
      <ul className="commitment-list" aria-label="Commitments">
        {detail.actionItems.map(item => <li key={item.id} data-done={item.done ? 'true' : undefined}>
          <span className="commitment-mark" aria-hidden="true">{item.done ? '☑' : '☐'}</span>
          <span className="commitment-text">{item.text}</span>
          <span className="small">{item.done ? 'Done' : 'Open'}</span>
        </li>)}
      </ul>
    </section>}

    {detail.agendaBlocks.length > 0 && <section className="card">
      <h1>Agenda</h1>
      <p>What the call set out to cover.</p>
      <ol className="agenda-list" aria-label="Agenda">
        {[...detail.agendaBlocks].sort((a, b) => a.sortOrder - b.sortOrder).map(block =>
          <li key={block.id} data-done={block.completed ? 'true' : undefined}>
            <span className="agenda-title">{block.title}</span>
            {block.prompt && <span className="small">{block.prompt}</span>}
          </li>)}
      </ol>
    </section>}

    {detail.chat.messages.length > 0 && <section className="card">
      <h1>Chat</h1>
      <p>Everything typed in the room, oldest first.</p>
      <ul className="transcript" aria-label="Call chat">
        {detail.chat.messages.map(message => {
          const sender = detail.participants.find(person => person.userId === message.senderId);
          return <li key={message.id}>
            <span className="avatar small" aria-hidden="true">{initials(sender?.displayName || '?')}</span>
            <div>
              <p className="transcript-who">
                {sender ? participantName(sender, me) : 'Someone who has left'}
                {message.createdAt && <span className="small"> · {stamp(message.createdAt)}</span>}
              </p>
              <p>{message.message}</p>
            </div>
          </li>;
        })}
      </ul>
    </section>}
  </>;
}
