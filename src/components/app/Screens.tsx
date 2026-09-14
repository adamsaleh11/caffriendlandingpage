'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api';
import type { AppCall, AppConnection, AppRank, AppSuggestion } from '@/lib/app-projection';
import type { EventSummary } from '@/lib/events';
import { eventsApi, problemMessage } from '@/components/events/client';
import { mergeUpcoming } from '@/lib/upcoming';
import Table, { type Column } from './Table';
import PersonProfile from './PersonProfile';
import Face, { type FacePerson } from './Face';
import UpcomingMeetings from './UpcomingMeetings';

/** Same-origin consumer fetch. The session cookie travels with it; no token is held here. */
async function app<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/app/${path}`, {
    ...options,
    headers: {'Content-Type':'application/json','X-Caffriend-Request':'1', ...options.headers},
    cache: 'no-store',
  });
  if (response.status === 401) { window.location.replace(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`); throw new ApiError(401, 'Sign in required'); }
  const result = await response.json();
  if (!response.ok) throw new ApiError(response.status, result.error || 'Please try again.');
  return result;
}

function useApp<T>(path: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setData(undefined); setError(undefined);
    app<T>(path).then(value => { if (live) setData(value); })
      .catch(problem => { if (live) setError(problem instanceof ApiError ? problem.message : 'This could not be loaded.'); });
    return () => { live = false; };
  }, [path, attempt]);
  return {data, error, reload: useCallback(() => setAttempt(v => v + 1), [])};
}

const nameColumn = <T extends FacePerson>(header: string): Column<T> => ({
  key:'name', header, sort: row => row.name,
  cell: row => <span className="person"><Face person={row} />{row.name}</span>,
});

/**
 * The Home categories. Events used to be a sidebar destination; it is a category
 * here instead, so the four ways of looking at Home sit side by side as bubbles
 * — the same pills the top navbar uses, and the same row the native app shows.
 */
const homeCategories = [
  {key:'all', label:'All'},
  {key:'mentee', label:'Mentees'},
  {key:'mentor', label:'Mentors'},
  {key:'events', label:'Events'},
] as const;
type HomeCategory = typeof homeCategories[number]['key'];

const eventMoney = (cents:number, currency:string) =>
  cents === 0 ? 'Free' : new Intl.NumberFormat('en-CA', {style:'currency', currency}).format(cents / 100);
const eventWhen = (value:string|null) =>
  value ? new Intl.DateTimeFormat('en-CA', {dateStyle:'long', timeStyle:'short'}).format(new Date(value)) : 'Time to be announced';

/** The Events category: the same upcoming rooms /events lists, in the Home card. */
function HomeEvents() {
  const [events, setEvents] = useState<EventSummary[]>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setEvents(undefined); setError('');
    eventsApi<EventSummary[]>('list')
      .then(rows => { if (live) setEvents(rows); })
      .catch(problem => { if (live) setError(problemMessage(problem)); });
    return () => { live = false; };
  }, [attempt]);

  if (error) return <><p role="alert">{error}</p><button className="secondary" onClick={() => setAttempt(v => v + 1)}>Try again</button></>;
  if (!events) return <p className="small">Loading events…</p>;
  if (events.length === 0) return <>
    <p>Nothing is scheduled yet. Be the first to bring a room together.</p>
    <Link className="secondary button-link" href="/events/new">Host an event</Link>
  </>;
  return <>
    <ul className="home-events">
      {events.map(event => <li key={event.id}>
        <p className="home-event-meta"><span>{eventWhen(event.startsAt)}</span><span>{eventMoney(event.priceCents, event.currency)}</span></p>
        <h3><Link href={`/events/${event.id}`}>{event.title}</Link></h3>
        <p>{event.description || 'A Caffriend gathering for conversations that go somewhere.'}</p>
        <p className="home-event-meta"><span>{event.capacity} seats</span><span>{event.status === 'ENDED' ? 'Ended' : 'Registration open'}</span></p>
      </li>)}
    </ul>
    <Link className="secondary button-link" href="/events/new">Host an event</Link>
  </>;
}

/**
 * Home — the same discovery queue the native app swipes through, as a table.
 * Paging follows the native rule: keep requesting while page < totalPages.
 */
export function Home() {
  const [category, setCategory] = useState<HomeCategory>('all');
  const role = category === 'mentee' || category === 'mentor' ? category : '';
  const [rows, setRows] = useState<AppSuggestion[]>();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [open, setOpen] = useState<AppSuggestion>();
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState('');
  const [more, setMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (category === 'events') return;
    let live = true;
    setRows(undefined); setError(undefined); setPage(1);
    app<{items:AppSuggestion[]; page:number; totalPages:number|null}>('suggestions',
      {method:'POST', body: JSON.stringify({page:1, limit:20, role: role || undefined})})
      .then(result => { if (live) { setRows(result.items); setTotalPages(result.totalPages); } })
      .catch(problem => { if (live) setError(problem instanceof ApiError ? problem.message : 'Suggestions could not be loaded.'); });
    return () => { live = false; };
  }, [category, role, attempt]);

  async function loadMore() {
    setMore(true);
    try {
      const next = page + 1;
      const result = await app<{items:AppSuggestion[]; page:number; totalPages:number|null}>('suggestions',
        {method:'POST', body: JSON.stringify({page:next, limit:20, role: role || undefined})});
      setRows(current => [...(current ?? []), ...result.items]);
      setPage(next); setTotalPages(result.totalPages);
    } catch (problem) { setActionError(problem instanceof ApiError ? problem.message : 'Unable to load more.'); }
    finally { setMore(false); }
  }

  /** Exactly what swipe-right does natively: create a match, and say when it matched. */
  async function accept(person: AppSuggestion) {
    setBusy(person.userId); setNotice(''); setActionError(undefined);
    try {
      const result = await app<{isMatched:boolean}>('create-match', {method:'POST', body: JSON.stringify({targetId: person.userId})});
      setRows(current => (current ?? []).filter(row => row.userId !== person.userId));
      setNotice(result.isMatched ? `You matched with ${person.name}.` : `You accepted ${person.name}. They will see it next time they look.`);
    } catch (problem) { setActionError(problem instanceof ApiError ? problem.message : 'That did not go through.'); }
    finally { setBusy(undefined); }
  }

  /** Declining is local: the backend has no reject call, so the row simply leaves the queue. */
  function decline(person: AppSuggestion) {
    setActionError(undefined);
    setRows(current => (current ?? []).filter(row => row.userId !== person.userId));
    setNotice(`You passed on ${person.name}.`);
  }

  // The same columns Connections shows, so a person reads the same way on both screens.
  const columns: Column<AppSuggestion>[] = [
    nameColumn('Person'),
    {key:'jobTitle', header:'Job title', sort: row => row.jobTitle ?? null, cell: row => row.jobTitle || '—'},
    {key:'company', header:'Company', sort: row => row.company ?? null, cell: row => row.company || '—'},
    {key:'industry', header:'Industry', sort: row => row.industry ?? null, cell: row => row.industry || '—'},
    {key:'location', header:'Location', sort: row => row.location ?? null, cell: row => row.location || '—'},
    {key:'matches', header:'Matches', sort: row => row.matches, cell: row => row.matches ?? '—'},
  ];

  return <>
    <h1>Home</h1>
    <p className="intro">{category === 'events' ? 'Rooms worth walking into.' : 'People you might want to meet.'}</p>
    <section className="card">
      <div className="category-bubbles" role="group" aria-label="Home category">
        {homeCategories.map(item => <button key={item.key} type="button"
          aria-pressed={category === item.key}
          onClick={() => setCategory(item.key)}>{item.label}</button>)}
      </div>
      {category === 'events' ? <HomeEvents /> : <>
      {notice && <p role="status" className="notice">{notice}</p>}
      {actionError && <p role="alert">{actionError}</p>}
      <Table caption="Suggested people" columns={columns} rows={rows?.map(row => ({...row, id: row.userId}))}
        error={error} onRetry={() => setAttempt(v => v + 1)}
        onOpen={row => setOpen(row)} empty="No suggestions right now. Check back a little later."
        action={row => <span className="row-buttons">
          <button disabled={busy === row.userId} onClick={() => accept(row)}>{busy === row.userId ? 'Accepting…' : 'Accept'}</button>
          <button className="secondary" disabled={busy === row.userId} onClick={() => decline(row)}>Decline</button>
        </span>} />
      {totalPages !== null && page < totalPages &&
        <button className="secondary" disabled={more} onClick={loadMore}>{more ? 'Loading…' : 'Load more'}</button>}
      </>}
    </section>
    {open && <PersonProfile userId={open.userId} name={open.name} onClose={() => setOpen(undefined)} />}
  </>;
}

export function Connections() {
  const {data, error, reload} = useApp<AppConnection[]>('connections');
  const [open, setOpen] = useState<AppConnection>();
  const columns: Column<AppConnection & {id:string}>[] = [
    nameColumn('Person'),
    {key:'jobTitle', header:'Job title', sort: row => row.jobTitle ?? null, cell: row => row.jobTitle || '—'},
    {key:'company', header:'Company', sort: row => row.company ?? null, cell: row => row.company || '—'},
    {key:'industry', header:'Industry', sort: row => row.industry ?? null, cell: row => row.industry || '—'},
    {key:'location', header:'Location', sort: row => row.location ?? null, cell: row => row.location || '—'},
    {key:'status', header:'Status', sort: row => row.isMatched ? 'Matched' : row.bucket,
      cell: row => row.isMatched ? 'Matched' : row.bucket === 'pending' ? 'Pending' : 'Connected'},
    {key:'updated', header:'Last activity', sort: row => row.updatedAt,
      cell: row => row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'},
  ];
  return <>
    <h1>Connections</h1>
    <p className="intro">People you are already connected with.</p>
    <section className="card">
      <Table caption="Your connections" columns={columns} rows={data?.map(row => ({...row, id: row.id || row.userId}))}
        error={error} onRetry={reload} onOpen={row => setOpen(row)}
        empty="No connections yet. Accept someone on Home to start one." />
    </section>
    {open && <PersonProfile userId={open.userId} name={open.name} onClose={() => setOpen(undefined)} />}
  </>;
}

export function Calls() {
  const {data, error, reload} = useApp<AppCall[]>('calls?type=1');
  // The consumer screen has no workspace, so there are no CRM meeting records to merge
  // in here — the accepted calendar events are the whole list. It is still projected
  // through `mergeUpcoming` so this screen and the Meetings page order, filter and
  // render a booking identically.
  const upcoming = data ? mergeUpcoming(data, [], Date.now()) : undefined;
  return <>
    <h1>Upcoming calls</h1>
    <p className="intro">Coffee chats you have agreed to.</p>
    <section className="card app-call-card">
      {error ? <><p role="alert">{error}</p><button className="secondary" onClick={reload}>Try again</button></>
        : !upcoming ? <ul className="up-list" aria-label="Upcoming calls" aria-busy="true">
            {[0,1,2].map(item => <li className="up-card up-loading" key={item}>
              <span className="avatar initials" aria-hidden="true" />
              <div><span /><span /><span /></div>
            </li>)}
          </ul>
        : upcoming.length === 0 ? <div className="empty">
            <span className="empty-symbol" aria-hidden="true">◎</span>
            <h2>No calls scheduled</h2>
            <p>Arrange a coffee chat from Connections, then it will appear here.</p>
          </div>
        : <UpcomingMeetings meetings={upcoming} label="Upcoming calls" />}
    </section>
  </>;
}

export function Leaderboard({meId}:{meId?: string}) {
  const {data, error, reload} = useApp<{items:AppRank[]; totalCount:number|null}>('leaderboard?limit=50');
  const [open, setOpen] = useState<AppRank>();
  const columns: Column<AppRank & {id:string}>[] = [
    {key:'rank', header:'Rank', sort: row => row.rank, cell: row => row.rank ?? '—'},
    nameColumn('Person'),
    {key:'score', header:'Score', sort: row => row.combinedScore, cell: row => row.combinedScore ?? '—'},
    {key:'chats', header:'Chats', sort: row => row.totalChats, cell: row => row.totalChats ?? '—'},
    {key:'matches', header:'Matches', sort: row => row.totalMatches, cell: row => row.totalMatches ?? '—'},
  ];
  const rows = data?.items.map(row => ({
    ...row, id: row.userId,
    name: row.userId === meId ? `${row.name} (you)` : row.name,
  }));
  return <>
    <h1>Leaderboard</h1>
    <p className="intro">How the community is doing.</p>
    <section className="card leaderboard">
      <Table caption="Leaderboard" columns={columns} rows={rows} error={error} onRetry={reload}
        onOpen={row => setOpen(row)} empty="The leaderboard is empty right now." />
    </section>
    {open && <PersonProfile userId={open.userId} name={open.name} onClose={() => setOpen(undefined)} />}
  </>;
}

/** The Profile screen is a full editor; it lives in its own file. */
export { default as Profile } from './ProfileScreen';
