'use client';
import { useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import Modal from './Modal';
import type { Loaded } from './common';

/** The CRM records the backend allows this product to edit and to archive. */
export type Editable = 'people' | 'organizations' | 'engagements' | 'notes' | 'tasks';

const at = (workspaceId: string, resource: Editable, id: string) => `workspaces/${workspaceId}/crm/${resource}/${id}`;
/**
 * A fresh key per attempt, not per form.
 *
 * An edit is a deliberate act the user may repeat with different values, and
 * reusing a key across those attempts would have the backend replay the first.
 */
const key = () => ({'X-Idempotency-Key': crypto.randomUUID()});

/** Change one record. Only the fields passed are touched; `null` clears an optional one. */
export const editRecord = <T,>(workspaceId: string, resource: Editable, id: string, body: Record<string, unknown>) =>
  api<T>(at(workspaceId, resource, id), {method: 'PATCH', body: JSON.stringify(body), headers: key()});

/**
 * Archive, never delete.
 *
 * The backend soft-archives: the record leaves every list but its audit history
 * survives, so nothing in this product may call the action "delete" or promise
 * that the trail is gone.
 */
export const archiveRecord = (workspaceId: string, resource: Editable, id: string) =>
  api(at(workspaceId, resource, id), {method: 'DELETE', headers: key()});

export const problemText = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

/** Archived rows still come back from the list endpoints. No screen shows them. */
export const live = <T extends {archivedAt?: string | null}>(rows: T[] | undefined) =>
  (rows ?? []).filter(row => !row.archivedAt);

/**
 * The same filter applied to a whole loaded list, so every reader shares it.
 *
 * Memoised on the loaded rows: a fresh array each render would change identity
 * on every pass and re-run any effect that depends on the list.
 */
export function useLiveRows<T extends {archivedAt?: string | null}>(loaded: Loaded<T>): Loaded<T> {
  const rows = loaded.rows;
  const shown = useMemo(() => rows?.filter(row => !row.archivedAt), [rows]);
  return shown === rows ? loaded : {...loaded, rows: shown};
}

/**
 * Archiving asks first, and the question names the record and what survives it.
 *
 * The confirmation is not a formality: archiving removes something from every
 * board and list the workspace works from, and a reader deserves to know that
 * the history stays before they agree to it.
 */
export function ArchiveButton({
  workspaceId, resource, id, name, what, keeps, label, className, onArchived, onProblem,
}:{
  workspaceId: string;
  resource: Editable;
  id: string;
  /** The record as the user knows it — a person's name, a note's first words. */
  name: string;
  /** The kind of thing, lowercase: "person", "note", "engagement". */
  what: string;
  /** What else goes with it, when archiving one record hides others. */
  keeps?: string;
  label?: string;
  className?: string;
  onArchived: () => void;
  onProblem?: (message: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState('');

  async function confirm() {
    setPending(true); setProblem('');
    try {
      await archiveRecord(workspaceId, resource, id);
      setAsking(false);
      onArchived();
    } catch (error) {
      const text = problemText(error, `That ${what} was not archived. Nothing has changed.`);
      setProblem(text); onProblem?.(text);
    } finally { setPending(false); }
  }

  return <>
    <button type="button" className={className ?? 'secondary small-button'} onClick={() => setAsking(true)}>
      {label ?? 'Archive'}<span className="sr-only"> {what} {name}</span>
    </button>
    {asking && <Modal title={`Archive this ${what}?`}
      description={`${name} will be hidden from every list in this workspace. The history stays in the timeline and the audit trail.`}
      onClose={() => { if (!pending) { setAsking(false); setProblem(''); } }}>
      {keeps && <p>{keeps}</p>}
      <p className="small">Archiving is not deletion. Nothing recorded about this {what} is destroyed.</p>
      {problem && <p role="alert">{problem}</p>}
      <div className="modal-actions">
        <button type="button" className="secondary" disabled={pending} onClick={() => { setAsking(false); setProblem(''); }}>Keep it</button>
        <button type="button" className="secondary danger" disabled={pending} onClick={confirm}>
          {pending ? 'Archiving…' : `Yes, archive this ${what}`}
        </button>
      </div>
    </Modal>}
  </>;
}
