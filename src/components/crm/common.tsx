'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/api';
import { rightsLabels, rightsExplanations, type Page, type RightsState, type SourceArtifact, type SourceClaim, type Conversation } from '@/lib/contracts';

/** A retry of the same submitted operation reuses its key; changed input gets a new one. */
export function useKeys() {
  const keys = useRef<Record<string,string>>({});
  return (id: string) => (keys.current[id] ??= crypto.randomUUID());
}

export type Loaded<T> = {
  rows: T[] | undefined;
  error: ApiError | undefined;
  loadingMore: boolean;
  more: boolean;
  reload: () => void;
  loadMore: () => void;
  /** Replace local rows without refetching, for optimistic movement. */
  set: (next: T[]) => void;
};

/**
 * A cursor-paginated CRM list.
 *
 * Keeps already-loaded rows on a failed page fetch so a partial list stays usable
 * rather than collapsing to an error screen — the ticket requires a partial state.
 */
export function useList<T>(path: string | null, deps: unknown[] = []): Loaded<T> {
  const [rows, setRows] = useState<T[]>();
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<ApiError>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  /**
   * A refresh keeps what is already on screen. Only a different list starts blank.
   *
   * Clearing rows on every reload unmounted whatever was reading them — a half-filled
   * form, an open panel — so recording something and then refreshing the record threw
   * away the confirmation the user had just earned.
   */
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!path) { setRows([]); shown.current = null; return; }
    const controller = new AbortController();
    if (shown.current !== path) { setRows(undefined); shown.current = path; }
    setError(undefined); setCursor(null);
    api<Page<T>>(path, {signal: controller.signal})
      .then(page => { if (controller.signal.aborted) return; setRows(page.items); setCursor(page.nextCursor); })
      .catch(problem => { if (!controller.signal.aborted) setError(problem instanceof ApiError ? problem : new ApiError(503, 'This is unavailable right now.')); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers declare what invalidates the list
  }, [path, attempt, ...deps]);

  const loadMore = useCallback(async () => {
    if (!path || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await api<Page<T>>(`${path}${path.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(cursor)}`);
      setRows(current => [...(current ?? []), ...page.items]);
      setCursor(page.nextCursor);
      setError(undefined);
    } catch (problem) {
      setError(problem instanceof ApiError ? problem : new ApiError(503, 'Unable to load more.'));
    } finally { setLoadingMore(false); }
  }, [path, cursor]);

  return { rows, error, loadingMore, more: !!cursor, reload: () => setAttempt(v => v + 1), loadMore, set: setRows };
}

/** A plain array endpoint. Pipelines and stages are not cursor-paginated. */
export function useRows<T>(path: string | null): Loaded<T> {
  const [rows, setRows] = useState<T[]>();
  const [error, setError] = useState<ApiError>();
  const [attempt, setAttempt] = useState(0);
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!path) { setRows(undefined); shown.current = null; return; }
    const controller = new AbortController();
    if (shown.current !== path) { setRows(undefined); shown.current = path; }
    setError(undefined);
    api<T[]>(path, {signal: controller.signal})
      .then(result => { if (!controller.signal.aborted) setRows(Array.isArray(result) ? result : []); })
      .catch(problem => { if (!controller.signal.aborted) setError(problem instanceof ApiError ? problem : new ApiError(503, 'This is unavailable right now.')); });
    return () => controller.abort();
  }, [path, attempt]);
  return { rows, error, loadingMore:false, more:false, reload: () => setAttempt(v => v + 1), loadMore: () => {}, set: setRows };
}

/** The standard states every primary screen owes the reader, in one place. */
export function Section({title, intro, state, children}:{title:string; intro?:string; state:{rows:unknown[]|undefined; error:ApiError|undefined; reload:()=>void}; children:ReactNode}) {
  const {rows, error, reload} = state;
  if (error && !rows) return <section className="card">
    <h1>{title}</h1>
    <p role="alert">{error.status === 403 ? 'You do not have access to this.' : error.status === 404 ? 'This is unavailable.' : error.message}</p>
    {error.status !== 403 && <button onClick={reload}>Try again</button>}
  </section>;
  if (!rows) return <section className="card"><h1>{title}</h1><p role="status">Loading {title.toLowerCase()}…</p></section>;
  return <section className="card">
    <h1>{title}</h1>
    {intro && <p>{intro}</p>}
    {/* A failed page fetch leaves the rows already loaded on screen. */}
    {error && <p role="alert">{error.message} <button className="secondary" onClick={reload}>Reload</button></p>}
    {children}
  </section>;
}

export function Empty({children}:{children:ReactNode}) {
  return <p className="empty-note">{children}</p>;
}

/** More rows exist than are shown. Never silently truncate. */
export function More({state}:{state:{more:boolean; loadingMore:boolean; loadMore:()=>void}}) {
  if (!state.more) return null;
  return <button className="secondary" disabled={state.loadingMore} onClick={state.loadMore}>{state.loadingMore ? 'Loading…' : 'Load more'}</button>;
}

export function Rights({state}:{state:RightsState}) {
  return <span className={`rights rights-${state.toLowerCase()}`}>{rightsLabels[state] ?? state}</span>;
}

/**
 * Everything a reviewer needs to judge a sourced fact before acting on it:
 * where it came from, what page, under what licence, and with what restrictions.
 */
export function Evidence({artifact, claims, conversation}:{artifact?:SourceArtifact; claims:SourceClaim[]; conversation?:Conversation}) {
  return <div className="evidence">
    <h4>Where this came from</h4>
    {artifact ? <dl>
      <dt>Source</dt><dd>{artifact.filename}{artifact.publisher ? ` — ${artifact.publisher}` : ''}</dd>
      <dt>Owner</dt><dd>{artifact.sourceOwner || 'Not recorded'}</dd>
      <dt>How it was obtained</dt><dd>{artifact.acquisitionMethod}</dd>
      <dt>Licence or terms</dt><dd>{artifact.licenseTermsRef
        ? <a href={artifact.licenseTermsRef} target="_blank" rel="noreferrer noopener">{artifact.licenseTermsRef}</a>
        : 'No licence reference recorded'}</dd>
      <dt>Permitted-use basis</dt><dd>{artifact.permittedUseBasis || 'No basis recorded'}</dd>
      <dt>Restrictions</dt><dd>{artifact.restrictions || 'None recorded'}</dd>
      <dt>Rights</dt><dd><Rights state={artifact.rightsState}/> {rightsExplanations[artifact.rightsState]}</dd>
      <dt>Permitted uses</dt><dd>{artifact.permittedUses.length ? artifact.permittedUses.join(', ') : 'None'}</dd>
      <dt>Reviewed</dt><dd>{artifact.reviewStatus === 'REVIEWED' ? `Reviewed${artifact.reviewAt ? ` on ${new Date(artifact.reviewAt).toLocaleString()}` : ''}` : 'Not yet reviewed'}</dd>
    </dl> : <p>No source artifact is attached to this.</p>}

    <h4>Cited claims</h4>
    {claims.length === 0 ? <p>No claims are cited.</p> : <ul className="claims">
      {claims.map(claim => <li key={claim.id}>
        <strong>{claim.targetField}</strong>: {typeof claim.extractedValue === 'string' ? claim.extractedValue : JSON.stringify(claim.extractedValue)}
        <span className="small"> Cited at {claim.locator} · confidence {Math.round(claim.confidence * 100)}% · <Rights state={claim.rightsState}/></span>
      </li>)}
    </ul>}

    <h4>Source chat</h4>
    {/* Linked only when the provider supplied a durable URL. Never reconstructed. */}
    {conversation?.durableUrl
      ? <p><a href={conversation.durableUrl} target="_blank" rel="noreferrer noopener">{conversation.title || 'Open the original chat'}<span aria-hidden="true"> ↗</span></a> <span className="small">at {conversation.provider}</span></p>
      : <p>{conversation ? `The chat stayed at ${conversation.provider}. ` : ''}A durable link is <strong>unavailable</strong>.</p>}
  </div>;
}
