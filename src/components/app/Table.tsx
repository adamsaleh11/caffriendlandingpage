'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export type Column<T> = {
  key: string;
  header: string;
  /** What the cell shows. */
  cell: (row: T) => ReactNode;
  /** What the column sorts by. Omit to make the column unsortable. */
  sort?: (row: T) => string | number | null;
};

/**
 * One table for every consumer screen. Rows are real table rows to a screen reader,
 * focusable, and activated with Enter or Space as well as a click, so the whole
 * screen works without a pointer.
 */
export default function Table<T extends {id: string}>({
  caption, columns, rows, loading, error, onRetry, onOpen, action, empty,
}:{
  caption: string;
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onOpen?: (row: T) => void;
  action?: (row: T) => ReactNode;
  empty: string;
}) {
  const [sort, setSort] = useState<{key: string; direction: 'asc'|'desc'}>();

  if (error) return <p role="alert">{error}{onRetry && <> <button className="secondary" onClick={onRetry}>Try again</button></>}</p>;
  if (loading || !rows) return <p role="status">Loading {caption.toLowerCase()}…</p>;
  if (rows.length === 0) return <p className="empty-note">{empty}</p>;

  const column = columns.find(item => item.key === sort?.key);
  const ordered = column?.sort
    ? [...rows].sort((a, b) => {
        const left = column.sort!(a), right = column.sort!(b);
        if (left === right) return 0;
        if (left === null) return 1;
        if (right === null) return -1;
        const result = left < right ? -1 : 1;
        return sort!.direction === 'asc' ? result : -result;
      })
    : rows;

  return <>
    <p className="small" role="status">{rows.length} {rows.length === 1 ? 'result' : 'results'}.</p>
    <table className="records">
      <caption className="small">{caption}</caption>
      <thead><tr>
        {columns.map(item => <th key={item.key} scope="col" aria-sort={sort?.key === item.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
          {item.sort
            ? <button className="sort" onClick={() => setSort(current =>
                current?.key === item.key ? {key:item.key, direction: current.direction === 'asc' ? 'desc' : 'asc'} : {key:item.key, direction:'asc'})}>
                {item.header}<span aria-hidden="true">{sort?.key === item.key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
              </button>
            : item.header}
        </th>)}
        {action && <th scope="col">Action</th>}
      </tr></thead>
      <tbody>
        {ordered.map(row => <tr key={row.id}
          tabIndex={onOpen ? 0 : undefined}
          className={onOpen ? 'activatable' : undefined}
          onClick={onOpen ? () => onOpen(row) : undefined}
          onKeyDown={onOpen ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(row); } } : undefined}>
          {columns.map((item, index) => index === 0
            ? <th key={item.key} scope="row">{item.cell(row)}</th>
            : <td key={item.key}>{item.cell(row)}</td>)}
          {action && <td onClick={event => event.stopPropagation()}>{action(row)}</td>}
        </tr>)}
      </tbody>
    </table>
  </>;
}

/** A dialog that traps focus while open and hands it back to whatever opened it. */
export function Modal({title, onClose, children}:{title:string; onClose:()=>void; children:ReactNode}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key !== 'Tab' || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return <div className="backdrop" onClick={onClose}>
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="modal" onClick={event => event.stopPropagation()}>
      <button className="secondary close" onClick={onClose}>Close</button>
      {children}
    </div>
  </div>;
}
