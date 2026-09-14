'use client';
import { useEffect, useState } from 'react';
import { participantName, type CallActionItem, type CallMessage, type CallParticipant, type CallState, type NoteScope } from '@/lib/call';
import type { AppPerson } from '@/lib/app-projection';
import { Icon, Hidden } from './Icon';

export type PanelTab = 'people' | 'chat' | 'notes' | 'actions' | 'agenda';

const tabs: {id: PanelTab; label: string}[] = [
  {id:'people', label:'People'},
  {id:'chat', label:'Chat'},
  {id:'notes', label:'Notes'},
  {id:'actions', label:'Actions'},
  {id:'agenda', label:'Agenda'},
];

export type PanelActions = {
  onSend: (text: string, reply: CallMessage | null, mentions: string[]) => Promise<void>;
  onAddNote: (scope: NoteScope, body: string) => Promise<void>;
  onToggleAction: (item: CallActionItem, done: boolean) => Promise<void>;
  onAddAction: (text: string) => Promise<void>;
  inviteUrl: string;
};


/**
 * The profile peek.
 *
 * The kit puts this inside the 396px panel rather than over the call, because it is
 * something you read *while* the other person is talking — a modal would cover the
 * face you are reading it about. It opened as the consumer app's profile modal for a
 * while, which is why it arrived unstyled: those rules are scoped under `.crm`, and the
 * call page does not load that stylesheet.
 *
 * The roster row is already on screen, so the peek opens with what the call knows —
 * name, role, title, company — and fills in the rest of the record when it arrives.
 * A guest has no session to read profiles with, so for them it simply stays at that.
 */
function Peek({person, me, onClose}:{person:CallParticipant; me:string; onClose:()=>void}) {
  const [profile, setProfile] = useState<AppPerson>();

  useEffect(() => {
    let live = true;
    setProfile(undefined);
    if (!person.userId) return;
    fetch(`/api/app/person/${encodeURIComponent(person.userId)}`,
      {headers:{'X-Caffriend-Request':'1'}, cache:'no-store'})
      .then(response => response.ok ? response.json() : null)
      .then(body => { if (live && body) setProfile(body as AppPerson); })
      // The peek is an enrichment of a row that is already readable. A profile that
      // will not load costs the extra detail, never the peek itself.
      .catch(() => undefined);
    return () => { live = false; };
  }, [person.userId]);

  const name = participantName(person, me);
  const headline = [profile?.jobTitle ?? person.jobTitle, profile?.company ?? person.company]
    .filter(Boolean).join(' @ ');
  const facts: {icon: string; value: string}[] = [
    {icon:'mortarboard', value:profile?.university ?? ''},
    {icon:'person-badge', value:profile?.pronouns ?? ''},
    {icon:'geo-alt', value:profile?.location ?? ''},
    {icon:'briefcase', value:profile?.industry ?? ''},
  ].filter(row => Boolean(row.value));

  const history = [
    profile?.matches != null ? `${profile.matches} mutual connection${profile.matches === 1 ? '' : 's'}` : null,
    profile?.coffeeChats != null ? `${profile.coffeeChats} coffee chat${profile.coffeeChats === 1 ? '' : 's'}` : null,
  ].filter(Boolean) as string[];

  return <section className="call-peek" aria-label={`${name} profile`}>
    <button className="call-peek-back" onClick={onClose}>
      <Icon name="chevron-left" size={13} />Back to the room
    </button>
    <div className="call-peek-head">
      {profile?.image
        // eslint-disable-next-line @next/next/no-img-element -- provider-hosted media are not a configured Next image domain
        ? <img className="call-peek-photo" src={profile.image} alt="" />
        : <span className="call-peek-photo call-peek-photo-empty" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
      <div>
        <h3 className="call-peek-name">{name}</h3>
        {person.role === 'host' && <span className="call-peek-role">Host</span>}
        {person.role === 'co_host' && <span className="call-peek-role">Co-host</span>}
        {headline && <p className="call-peek-headline">{headline}</p>}
      </div>
    </div>

    {facts.length > 0 && <ul className="call-peek-facts">
      {facts.map(row => <li key={row.icon}>
        <Icon name={row.icon} size={14} color="var(--caf-grey-600)" />{row.value}
      </li>)}
    </ul>}

    {profile?.coffeeChatTags && profile.coffeeChatTags.length > 0 && <>
      <h4 className="call-peek-label">Wants to talk about</h4>
      <ul className="call-peek-tags">
        {profile.coffeeChatTags.map(tag => <li key={tag}>{tag}</li>)}
      </ul>
    </>}

    {history.length > 0 && <>
      <h4 className="call-peek-label">Between you</h4>
      <p className="call-peek-history">{history.join(' · ')}</p>
    </>}
  </section>;
}

function People({state, me, inviteUrl}:{state:CallState; me:string; inviteUrl:string}) {
  const [peek, setPeek] = useState<CallParticipant>();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); }
    catch { setCopied(false); }
  }

  if (peek) return <Peek person={peek} me={me} onClose={() => setPeek(undefined)} />;

  return <>
    <h2 id="call-roster-heading">In the room · {state.participants.length}</h2>
    <ul className="call-roster" aria-labelledby="call-roster-heading">
      {state.participants.map(person => <li key={person.id}>
        <button className="call-roster-open" onClick={() => setPeek(person)}>
          <span className="call-roster-name">{participantName(person, me)}</span>
          {person.role === 'host' && <span className="call-roster-role">Host</span>}
          {person.role === 'co_host' && <span className="call-roster-role">Co-host</span>}
          <span className="call-roster-detail">{[person.jobTitle, person.company].filter(Boolean).join(' · ')}</span>
          <span className="call-roster-icons">
            {person.handRaised && <><Icon name="hand-index-thumb" size={15} color="var(--caf-orange)" /><Hidden>Hand raised</Hidden></>}
            {!person.micOn && <><Icon name="mic-mute" size={15} /><Hidden>Muted</Hidden></>}
            {!person.cameraOn && <><Icon name="camera-video-off" size={15} /><Hidden>Camera off</Hidden></>}
            <span className="call-quality-dot" data-weak={person.connectionQuality === 'weak' ? 'true' : undefined} />
            <Icon name="chevron-right" size={13} />
          </span>
        </button>
      </li>)}
    </ul>
    <button className="call-invite" onClick={copy}><Icon name="link-45deg" size={16} />Copy invite link</button>
    {copied && <p role="status">Invite link copied</p>}
  </>;
}

/**
 * Mentions are stored as user ids and written into the text as "@Display Name", so the
 * text is readable to anyone — including a client that does not resolve mentions — and
 * the ids stay authoritative for who was actually mentioned.
 */
function withMentions(text: string, people: CallParticipant[]) {
  const names = people.map(person => person.displayName).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length) return text;
  const pattern = new RegExp(`@(${names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > at) out.push(text.slice(at, index));
    out.push(<span className="call-mention" key={`${index}-${match[0]}`}>{match[0]}</span>);
    at = index + match[0].length;
  }
  out.push(text.slice(at));
  return out;
}

function Message({message, people, me, quoted, onReply}:{
  message:CallMessage; people:CallParticipant[]; me:string;
  quoted?:CallMessage; onReply?:(message:CallMessage)=>void;
}) {
  const sender = people.find(row => row.userId === message.senderId);
  const when = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'})
    : '';
  return <li className="call-message">
    <span className="call-message-who">{message.senderId === me ? 'You' : sender?.displayName ?? 'Caffriend member'}</span>
    <span className="call-message-when">{when}</span>
    {onReply && <button className="call-message-reply" onClick={() => onReply(message)} title="Reply">
      <Icon name="reply" size={12} /><Hidden>Reply</Hidden>
    </button>}
    {quoted && <p className="call-quote">{quoted.message}</p>}
    <p>{withMentions(message.message, people)}</p>
    {message.resourceCards.map((card, index) => <p className="call-resource" key={index}>
      <span className="call-resource-mark" aria-hidden="true"><Icon name="file-earmark-text" size={17} color="var(--caf-orange)" /></span>
      <span className="call-resource-body">
        {card.url ? <a href={card.url} target="_blank" rel="noreferrer noopener">{card.title}</a> : card.title}
        {card.meta && <span className="call-resource-meta">{card.meta}</span>}
      </span>
    </p>)}
  </li>;
}

function Chat({state, me, onSend, readOnly}:{state:CallState; me:string; onSend:PanelActions['onSend']; readOnly:boolean}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState('');
  const [replyTo, setReplyTo] = useState<CallMessage | null>(null);
  const [mentions, setMentions] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);

  const named = (userId: string) =>
    state.participants.find(row => row.userId === userId)?.displayName ?? 'Caffriend member';

  function mention(person: CallParticipant) {
    setDraft(current => `${current}@${person.displayName} `);
    setMentions(current => current.includes(person.userId) ? current : [...current, person.userId]);
    setPicking(false);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true); setProblem('');
    try {
      // Only mentions still present in the text are sent: picking someone and then
      // deleting their name should not quietly notify them.
      const kept = mentions.filter(id => text.includes(`@${named(id)}`));
      await onSend(text, replyTo, kept);
      setDraft(''); setReplyTo(null); setMentions([]);
    }
    catch (failure) { setProblem(failure instanceof Error ? failure.message : 'That message could not be sent.'); }
    finally { setSending(false); }
  }

  return <>
    <p className="call-chat-note">This thread started before the call and stays after it.</p>
    {problem && <p role="alert">{problem}</p>}
    <ul className="call-chat" aria-label="Call chat" role="log">
      {state.chat.messages.map(message =>
        <Message key={message.id} message={message} people={state.participants} me={me}
          quoted={state.chat.messages.find(row => row.id === message.replyToMessageId)}
          onReply={readOnly ? undefined : setReplyTo} />)}
    </ul>
    {!readOnly && <>
      {replyTo && <p role="status" className="call-replying">
        Replying to {replyTo.senderId === me ? 'yourself' : named(replyTo.senderId)}
        <button onClick={() => setReplyTo(null)}>Cancel reply</button>
      </p>}
      {picking && <ul className="call-mention-list" role="listbox" aria-label="Mention someone">
        {state.participants.filter(person => person.userId !== me).map(person =>
          <li key={person.id} role="option" aria-selected="false">
            <button onClick={() => mention(person)}>{person.displayName}</button>
          </li>)}
      </ul>}
      <form className="call-composer" onSubmit={send}>
        <label className="call-sr" htmlFor="call-message">Message</label>
        <input id="call-message" value={draft} onChange={event => setDraft(event.target.value)}
          placeholder="Type your message" autoComplete="off" />
        <button type="button" className="call-composer-icon" aria-label="Mention someone"
          aria-expanded={picking} onClick={() => setPicking(value => !value)}><Icon name="at" size={18} /></button>
        <button type="submit" className="call-composer-send" disabled={sending}>
          <Icon name="send-fill" size={15} /><Hidden>Send</Hidden>
        </button>
      </form>
    </>}
  </>;
}

const scopeLabels: {id: NoteScope; label: string; hint: string}[] = [
  {id:'private', label:'Private', hint:'Only you can see these.'},
  {id:'shared', label:'Shared', hint:'Everyone in the room can edit these.'},
  {id:'ai', label:'AI notes', hint:'Generated for this call with everyone’s consent.'},
];

function Notes({state, onAddNote}:{state:CallState; onAddNote:PanelActions['onAddNote']}) {
  const [scope, setScope] = useState<NoteScope>('private');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  // `call-state` has already dropped other people's private notes, so this is a
  // presentation filter, not the thing keeping them apart.
  const shown = state.notes.filter(note => note.scope === scope);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || saving) return;
    setSaving(true); setProblem('');
    try { await onAddNote(scope, body); setDraft(''); }
    catch (failure) { setProblem(failure instanceof Error ? failure.message : 'That note could not be saved.'); }
    finally { setSaving(false); }
  }

  return <>
    <div role="radiogroup" aria-label="Note visibility" className="call-scopes">
      {scopeLabels.map(row => <button key={row.id} role="radio" aria-checked={scope === row.id}
        tabIndex={scope === row.id ? 0 : -1} onClick={() => setScope(row.id)}>{row.label}</button>)}
    </div>
    <p className="call-scope-hint">{scopeLabels.find(row => row.id === scope)?.hint}</p>
    {problem && <p role="alert">{problem}</p>}
    <ul className="call-notes" aria-label="Notes">
      {shown.map(note => <li key={note.id}>{note.body}</li>)}
    </ul>
    {shown.length === 0 && <p className="call-empty">Nothing here yet.</p>}
    {/* AI notes are written by the call, not typed into it. */}
    {scope !== 'ai' && <form className="call-composer" onSubmit={add}>
      <label className="call-sr" htmlFor="call-note">Add a note</label>
      <input id="call-note" value={draft} onChange={event => setDraft(event.target.value)}
        placeholder="Add a note…" autoComplete="off" />
      <button type="submit" className="call-composer-send" disabled={saving}>
        <Icon name="plus-lg" size={15} /><Hidden>Add note</Hidden>
      </button>
    </form>}
  </>;
}

function Actions({state, onToggleAction, onAddAction}:{state:CallState; onToggleAction:PanelActions['onToggleAction']; onAddAction:PanelActions['onAddAction']}) {
  const [problem, setProblem] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const open = state.actionItems.filter(item => !item.done).length;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true); setProblem('');
    try { await onAddAction(text); setDraft(''); }
    catch (failure) { setProblem(failure instanceof Error ? failure.message : 'That could not be saved.'); }
    finally { setSaving(false); }
  }

  async function toggle(item: CallActionItem, done: boolean) {
    setProblem('');
    try { await onToggleAction(item, done); }
    catch (failure) { setProblem(failure instanceof Error ? failure.message : 'That could not be saved.'); }
  }

  return <>
    <h2>{open === 1 ? '1 open commitment' : `${open} open commitments`}</h2>
    {problem && <p role="alert">{problem}</p>}
    <ul className="call-actions" aria-label="Action items">
      {state.actionItems.map(item => {
        const owner = state.participants.find(row => row.userId === item.ownerUserId);
        const due = item.dueAt ? new Date(item.dueAt).toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'}) : null;
        return <li key={item.id}>
          <label>
            <input type="checkbox" checked={item.done} onChange={event => toggle(item, event.target.checked)} />
            <span className={item.done ? 'call-action-done' : undefined}>{item.text}</span>
          </label>
          <span className="call-action-meta">{[owner?.displayName, due].filter(Boolean).join(' · ')}</span>
        </li>;
      })}
    </ul>
    <form className="call-composer" onSubmit={add}>
      <label className="call-sr" htmlFor="call-action">Add an action</label>
      <input id="call-action" value={draft} onChange={event => setDraft(event.target.value)}
        placeholder="Add an action…" autoComplete="off" />
      <button type="submit" className="call-composer-send" disabled={saving}>
        <Icon name="plus-lg" size={15} /><Hidden>Add action</Hidden>
      </button>
    </form>
    <h3>Shared resources</h3>
    <ul className="call-resources" aria-label="Shared resources">
      {state.chat.messages.flatMap(message => message.resourceCards.map((card, index) =>
        <li key={`${message.id}-${index}`}>
          {card.url ? <a href={card.url} target="_blank" rel="noreferrer noopener">{card.title}</a> : card.title}
        </li>))}
    </ul>
  </>;
}

function Agenda({state}:{state:CallState}) {
  return <>
    <h2>Agenda</h2>
    <ul className="call-agenda" aria-label="Agenda">
      {state.agendaBlocks.map(block => <li key={block.id} className={block.completed ? 'call-agenda-done' : undefined}>
        <span className="call-agenda-mark" aria-hidden="true">
          {block.completed && <Icon name="check-lg" size={10} color="var(--caf-white)" />}
        </span>
        <span className="call-agenda-title">{block.title}</span>
        {block.completed && <Hidden>Done</Hidden>}
        {block.prompt && <span className="call-agenda-prompt">
          <Icon name="chat-quote" size={15} color="var(--caf-orange)" />{block.prompt}
        </span>}
      </li>)}
    </ul>
    {state.agendaBlocks.length === 0 && <p className="call-empty">No agenda for this call.</p>}
  </>;
}

export function RelationshipPanel({state, me, actions, readOnly = false}:{
  state:CallState; me:string; actions:PanelActions; readOnly?:boolean;
}) {
  const [tab, setTab] = useState<PanelTab>('people');
  return <aside className="call-panel">
    <div role="tablist" aria-label="Call panel" className="call-tabs">
      {tabs.map(row => <button key={row.id} role="tab" id={`call-tab-${row.id}`}
        aria-selected={tab === row.id} aria-controls={`call-tabpanel-${row.id}`}
        tabIndex={tab === row.id ? 0 : -1} onClick={() => setTab(row.id)}>{row.label}</button>)}
    </div>
    <div role="tabpanel" id={`call-tabpanel-${tab}`} aria-labelledby={`call-tab-${tab}`} className="call-tabpanel">
      {tab === 'people' && <People state={state} me={me} inviteUrl={actions.inviteUrl} />}
      {tab === 'chat' && <Chat state={state} me={me} onSend={actions.onSend} readOnly={readOnly} />}
      {tab === 'notes' && <Notes state={state} onAddNote={actions.onAddNote} />}
      {tab === 'actions' && <Actions state={state} onToggleAction={actions.onToggleAction} onAddAction={actions.onAddAction} />}
      {tab === 'agenda' && <Agenda state={state} />}
    </div>
  </aside>;
}
