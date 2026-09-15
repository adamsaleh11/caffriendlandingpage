'use client';
import { useState } from 'react';
import type { Engagement, Note, Task } from '@/lib/contracts';
import { engagementStatuses } from '@/lib/contracts';
import { FormSelect } from '@/components/ui/form-select';
import { DatePicker } from '@/components/ui/date-picker';

/**
 * The forms that correct a record that already exists.
 *
 * Each one is handed the record and gives back only the fields that actually
 * changed, so an edit never rewrites a column the user did not touch. Saving is
 * the caller's job: it owns the reload and the message, and these stay open until
 * it reports the write succeeded.
 */
type Save = (body: Record<string, unknown>) => Promise<boolean | void>;

function Actions({pending, onCancel, label}:{pending:boolean; onCancel:()=>void; label:string}) {
  return <div className="modal-actions">
    <button type="button" className="secondary" disabled={pending} onClick={onCancel}>Cancel</button>
    <button disabled={pending}>{pending ? 'Saving…' : label}</button>
  </div>;
}

/** An edit that changes nothing is not a write. */
function useSubmit(onSave: Save) {
  const [pending, setPending] = useState(false);
  return {pending, run: async (body: Record<string, unknown>, unchanged: () => void) => {
    if (Object.keys(body).length === 0) { unchanged(); return; }
    setPending(true);
    try { await onSave(body); } finally { setPending(false); }
  }};
}

export function NoteEditor({note, onSave, onCancel}:{note:Note; onSave:Save; onCancel:()=>void}) {
  const {pending, run} = useSubmit(onSave);
  return <form onSubmit={event => {
    event.preventDefault();
    const body = String(new FormData(event.currentTarget).get('body') ?? '').trim();
    run(body && body !== note.body ? {body} : {}, onCancel);
  }}>
    <label className="field">
      <span className="field-label">Note</span>
      <textarea name="body" rows={5} required maxLength={20000} defaultValue={note.body} autoFocus />
    </label>
    <Actions pending={pending} onCancel={onCancel} label="Save note" />
  </form>;
}

/** Tasks are OPEN until they are DONE; an unexpected stored status is kept, not discarded. */
const taskStatuses = ['OPEN', 'DONE'];
const asDate = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 10) : '';

export function TaskEditor({task, onSave, onCancel}:{task:Task; onSave:Save; onCancel:()=>void}) {
  const {pending, run} = useSubmit(onSave);
  const [status, setStatus] = useState(task.status);
  const [due, setDue] = useState(asDate(task.dueAt));
  return <form onSubmit={event => {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get('title') ?? '').trim();
    const body: Record<string, unknown> = {};
    if (title && title !== task.title) body.title = title;
    if (status !== task.status) body.status = status;
    // Clearing the date is a real change, so an emptied field sends null rather
    // than being read as "leave the due date alone".
    if (due !== asDate(task.dueAt)) body.dueAt = due ? new Date(`${due}T09:00:00`).toISOString() : null;
    run(body, onCancel);
  }}>
    <label className="field">
      <span className="field-label">What is owed</span>
      <input name="title" required maxLength={500} defaultValue={task.title} autoFocus />
    </label>
    <div className="field-grid">
      <div className="field">
        <span className="field-label">Status</span>
        <FormSelect aria-label="Status" value={status} onValueChange={setStatus}
          options={[...new Set([task.status, ...taskStatuses])].map(value => ({value, label: value.toLowerCase()}))} />
      </div>
      <div className="field">
        <span className="field-label">Due</span>
        {/* An existing task may be overdue, so past dates stay selectable here. */}
        <DatePicker aria-label="Due" value={due} onChange={setDue} fromToday={false} placeholder="No due date" />
        {due && <button type="button" className="link" onClick={() => setDue('')}>Clear the due date</button>}
      </div>
    </div>
    <Actions pending={pending} onCancel={onCancel} label="Save task" />
  </form>;
}

export function EngagementEditor({engagement, onSave, onCancel}:{engagement:Engagement; onSave:Save; onCancel:()=>void}) {
  const {pending, run} = useSubmit(onSave);
  const [status, setStatus] = useState(engagement.status);
  return <form onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const objective = String(data.get('objective') ?? '').trim();
    const nextAction = String(data.get('nextAction') ?? '').trim();
    const body: Record<string, unknown> = {};
    if (objective && objective !== engagement.objective) body.objective = objective;
    if (nextAction !== (engagement.nextAction ?? '')) body.nextAction = nextAction || null;
    if (status !== engagement.status) body.status = status;
    run(body, onCancel);
  }}>
    <p className="small">The stage is changed on the engagement itself, so it stays one deliberate move on the board.</p>
    <label className="field">
      <span className="field-label">What are you trying to achieve?</span>
      <input name="objective" required maxLength={2000} defaultValue={engagement.objective} autoFocus />
    </label>
    <label className="field">
      <span className="field-label">Next action</span>
      <input name="nextAction" maxLength={2000} defaultValue={engagement.nextAction ?? ''} placeholder="Send a short intro message" />
    </label>
    <div className="field">
      <span className="field-label">Status</span>
      <FormSelect aria-label="Status" value={status} onValueChange={setStatus}
        options={[...new Set([engagement.status, ...engagementStatuses])].map(value => ({value, label: value.replace('_', ' ').toLowerCase()}))} />
    </div>
    <Actions pending={pending} onCancel={onCancel} label="Save engagement" />
  </form>;
}
