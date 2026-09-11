'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api';
import type { AppCall, AppConnection, AppProfile, AppRank, AppSuggestion } from '@/lib/app-projection';
import Table, { Modal, type Column } from './Table';

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

type FacePerson = { name: string; image: string | null };
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
function Face({person}:{person:FacePerson}) {
  return person.image
    // eslint-disable-next-line @next/next/no-img-element -- provider-hosted avatars are not a configured Next image domain
    ? <img className="avatar" src={person.image} alt="" width={32} height={32} />
    : <span className="avatar initials" aria-hidden="true">{initials(person.name)}</span>;
}
const nameColumn = <T extends FacePerson>(header: string): Column<T> => ({
  key:'name', header, sort: row => row.name,
  cell: row => <span className="person"><Face person={row} />{row.name}</span>,
});
const when = (value: string | null) => value ? new Date(value).toLocaleString() : '—';

function PersonCard({person, onClose, children}:{person:FacePerson; onClose:()=>void; children:React.ReactNode}) {
  return <Modal title={person.name} onClose={onClose}>
    <div className="profile-card">
      <Face person={person} />
      <h2>{person.name}</h2>
      {children}
    </div>
  </Modal>;
}

/**
 * Home — the same discovery queue the native app swipes through, as a table.
 * Paging follows the native rule: keep requesting while page < totalPages.
 */
export function Home() {
  const [role, setRole] = useState('');
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
    let live = true;
    setRows(undefined); setError(undefined); setPage(1);
    app<{items:AppSuggestion[]; page:number; totalPages:number|null}>('suggestions',
      {method:'POST', body: JSON.stringify({page:1, limit:20, role: role || undefined})})
      .then(result => { if (live) { setRows(result.items); setTotalPages(result.totalPages); } })
      .catch(problem => { if (live) setError(problem instanceof ApiError ? problem.message : 'Suggestions could not be loaded.'); });
    return () => { live = false; };
  }, [role, attempt]);

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

  const columns: Column<AppSuggestion>[] = [
    nameColumn('Person'),
    {key:'role', header:'Role', sort: row => row.role, cell: row => row.role || '—'},
    {key:'rating', header:'Rating', sort: row => row.avgRating, cell: row => row.avgRating === null ? '—' : row.avgRating.toFixed(1)},
    {key:'matches', header:'Matches', sort: row => row.matches, cell: row => row.matches ?? '—'},
  ];

  return <>
    <h1>Home</h1>
    <p className="intro">People you might want to meet.</p>
    <section className="card">
      <form className="filters" onSubmit={event => event.preventDefault()}>
        <label>Role
          <select value={role} onChange={event => setRole(event.target.value)}>
            <option value="">Everyone</option><option value="mentor">Mentors</option><option value="mentee">Mentees</option>
          </select>
        </label>
      </form>
      {notice && <p role="status" className="notice">{notice}</p>}
      {actionError && <p role="alert">{actionError}</p>}
      <Table caption="Suggested people" columns={columns} rows={rows?.map(row => ({...row, id: row.userId}))}
        error={error} onRetry={() => setAttempt(v => v + 1)}
        onOpen={row => setOpen(row)} empty="No suggestions right now. Check back a little later."
        action={row => <button disabled={busy === row.userId} onClick={() => accept(row)}>{busy === row.userId ? 'Accepting…' : 'Accept'}</button>} />
      {totalPages !== null && page < totalPages &&
        <button className="secondary" disabled={more} onClick={loadMore}>{more ? 'Loading…' : 'Load more'}</button>}
    </section>
    {open && <PersonCard person={open} onClose={() => setOpen(undefined)}>
      <dl>
        <dt>Role</dt><dd>{open.role || 'Not given'}</dd>
        <dt>Rating</dt><dd>{open.avgRating === null ? 'No ratings yet' : open.avgRating.toFixed(1)}</dd>
        <dt>Matches</dt><dd>{open.matches ?? '—'}</dd>
      </dl>
    </PersonCard>}
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
    {open && <PersonCard person={open} onClose={() => setOpen(undefined)}>
      <dl>
        <dt>Job title</dt><dd>{open.jobTitle || 'Not given'}</dd>
        <dt>Company</dt><dd>{open.company || 'Not given'}</dd>
        <dt>Industry</dt><dd>{open.industry || 'Not given'}</dd>
        <dt>University</dt><dd>{open.university || 'Not given'}</dd>
        <dt>Location</dt><dd>{open.location || 'Not given'}</dd>
        <dt>Pronouns</dt><dd>{open.pronouns || 'Not given'}</dd>
        <dt>Role</dt><dd>{open.role || 'Not given'}</dd>
        <dt>Rating</dt><dd>{open.avgRating === null || open.avgRating === undefined ? 'No ratings yet' : open.avgRating.toFixed(1)}</dd>
        <dt>Coffee chats</dt><dd>{open.matches ?? '—'}</dd>
        <dt>Status</dt><dd>{open.isMatched ? 'Matched' : 'Connected'}</dd>
        <dt>Last activity</dt><dd>{when(open.updatedAt)}</dd>
      </dl>
      {(open.linkedInUrl || open.websiteUrl) && <p>
        {open.linkedInUrl && <a href={open.linkedInUrl} target="_blank" rel="noreferrer noopener">LinkedIn</a>}
        {open.linkedInUrl && open.websiteUrl && ' · '}
        {open.websiteUrl && <a href={open.websiteUrl} target="_blank" rel="noreferrer noopener">Website</a>}
      </p>}
    </PersonCard>}
  </>;
}

export function Calls() {
  const {data, error, reload} = useApp<AppCall[]>('calls?type=1');
  const columns: Column<AppCall>[] = [
    {key:'time', header:'When', sort: row => row.startDate,
      cell: row => row.startDate
        ? `${new Date(row.startDate).toLocaleString()}${row.endDate ? ` – ${new Date(row.endDate).toLocaleTimeString()}` : ''}`
        : 'Not scheduled'},
    {key:'who', header:'With', sort: row => row.counterpart, cell: row => row.counterpart || '—'},
    {key:'format', header:'Format', sort: row => row.format, cell: row => row.format || 'Not specified'},
    {key:'notes', header:'Notes', cell: row => row.notes || '—'},
  ];
  return <>
    <h1>Upcoming calls</h1>
    <p className="intro">Coffee chats you have agreed to.</p>
    <section className="card">
      <Table caption="Upcoming calls" columns={columns} rows={data} error={error} onRetry={reload}
        empty="Nothing scheduled. Arrange a coffee chat from Connections."
        action={row => row.needsPayment
          ? <span className="small">Payment required</span>
          : <span className="small">Join from the Caffriend app</span>} />
      {/* Joining runs on LiveKit inside the native app; this surface does not host the call. */}
      <p className="small">Calls are joined in the Caffriend mobile app.</p>
      {/*
        These are Caffriend app bookings. A meeting scheduled from a CRM workspace is a
        separate backend record on a separate calendar and is not merged in here; saying
        so is more honest than showing a combined list the server does not have.
      */}
      <p className="small">Meetings you schedule inside a CRM workspace are listed on that workspace&apos;s Meetings screen, not here.</p>
    </section>
  </>;
}

export function Leaderboard({meId}:{meId?: string}) {
  const {data, error, reload} = useApp<{items:AppRank[]; totalCount:number|null}>('leaderboard?limit=50');
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
        empty="The leaderboard is empty right now." />
    </section>
  </>;
}

export function Profile() {
  const {data, error, reload} = useApp<AppProfile>('me');
  if (error) return <><h1>Profile</h1><p role="alert">{error} <button className="secondary" onClick={reload}>Try again</button></p></>;
  if (!data) return <><h1>Profile</h1><p role="status">Loading your profile…</p></>;
  return <>
    <h1>Profile</h1>
    <p className="intro">How you appear to other people on Caffriend.</p>
    <section className="card">
      <div className="profile-card">
        <Face person={data} />
        <h2>{data.name}</h2>
        <dl>
          <dt>Email</dt><dd>{data.email || 'Not given'}</dd>
          <dt>Role</dt><dd>{data.role || 'Not given'}</dd>
        </dl>
        {data.bio && <><h3>About</h3><p>{data.bio}</p></>}
      </div>
      {/* Editing lives in the native app, which owns the full profile form. */}
      <p className="small">Edit your profile in the Caffriend mobile app. <Link className="text-link" href="/app">Go to your CRM →</Link></p>
    </section>
  </>;
}
