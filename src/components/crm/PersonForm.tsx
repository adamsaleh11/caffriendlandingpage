'use client';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Organization, Person } from '@/lib/contracts';
import { useKeys } from './common';
import { completeness, extendedFields, missingFields, profileFields, sourceCategories, valueOf, type ProfileField } from './person-profile';
import {FormSelect} from '@/components/ui/form-select';

const byName = (name: ProfileField['name']) => profileFields.find(field => field.name === name)!;

/** Empty clears the stored value; the backend accepts null on every optional person field. */
const forWire = (raw: string) => (raw.trim() ? raw.trim() : null);

/**
 * One write of a person, with a fallback for the field-registry update.
 *
 * `sourceUrl` and `discoveryReason` are columns the backend has always had but
 * only recently accepts through the CRM write path. Against a backend without
 * that change the write is retried without them rather than losing the edit, and
 * the caller is told which fields did not land.
 */
async function writePerson(
  path: string, method: 'POST'|'PATCH', body: Record<string, unknown>, key: string,
): Promise<{person: Person; dropped: string[]}> {
  const send = (payload: Record<string, unknown>) => api<Person>(path, {
    method, body: JSON.stringify(payload), headers: {'X-Idempotency-Key': key},
  });
  try {
    return {person: await send(body), dropped: []};
  } catch (error) {
    const unknownField = error instanceof ApiError && error.status === 400 && /unknown input field/i.test(error.message);
    const extended = extendedFields.filter(name => name in body);
    if (!unknownField || extended.length === 0) throw error;
    const trimmed = {...body};
    for (const name of extended) delete trimmed[name];
    return {person: await send(trimmed), dropped: [...extended]};
  }
}

function Field({field, person, organizations}:{field: ProfileField; person?: Person; organizations: Organization[]}) {
  const value = person ? valueOf(person, field) : '';
  if (field.kind === 'organization') return <div className="field">
    <span className="field-label">{field.label}</span>
    <FormSelect name="organizationId" aria-label={field.label} defaultValue={value} options={[{value:'',label:'No organization'},...organizations.map(row => ({value:row.id,label:row.name}))]} />
  </div>;
  if (field.kind === 'long') return <label className="field wide">
    <span className="field-label">{field.label}</span>
    <textarea name={field.name} rows={4} maxLength={field.max} defaultValue={value} placeholder={field.placeholder} />
  </label>;
  return <label className="field">
    <span className="field-label">{field.label}</span>
    <input name={field.name} type={field.kind}
      required={field.name === 'displayName'} maxLength={field.max}
      defaultValue={value} placeholder={field.placeholder} />
  </label>;
}

/**
 * Adding a person: the four things you always know, and nothing else.
 *
 * Everything optional is deliberately left out. It is asked for later, one field
 * at a time, on the person's own page — where the progress bar makes it obvious
 * what is still missing and why it is worth having.
 */
export function AddPersonForm({workspaceId, organizations, onCreated, onCancel}:{
  workspaceId: string;
  organizations: Organization[];
  onCreated: (person: Person) => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState('');
  const [source, setSource] = useState('MANUAL');
  const keyFor = useKeys();
  const hint = sourceCategories.find(row => row.value === source)?.hint;

  async function submit(form: FormData) {
    const body: Record<string, unknown> = {
      displayName: String(form.get('displayName') ?? '').trim(),
      sourceCategory: source,
    };
    for (const name of ['title','email'] as const) {
      const value = String(form.get(name) ?? '').trim();
      if (value) body[name] = value;
    }
    const organizationId = String(form.get('organizationId') ?? '');
    if (organizationId) body.organizationId = organizationId;

    setPending(true); setProblem('');
    try {
      const {person} = await writePerson(`workspaces/${workspaceId}/crm/people`, 'POST', body, keyFor(`person:${JSON.stringify(body)}`));
      onCreated(person);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That did not save. Try again.');
    } finally { setPending(false); }
  }

  return <form className="person-form" onSubmit={event => { event.preventDefault(); submit(new FormData(event.currentTarget)); }}>
    <div className="field-grid">
      <Field field={byName('displayName')} organizations={organizations} />
      <Field field={byName('title')} organizations={organizations} />
      <Field field={byName('organizationId')} organizations={organizations} />
      <Field field={byName('email')} organizations={organizations} />
      <div className="field wide">
        <span className="field-label">How did you get their details?</span>
        <FormSelect aria-label="How did you get their details?" value={source} onValueChange={setSource} options={sourceCategories.map(row => ({value:row.value,label:row.label}))} />
        <span className="small">{hint}</span>
      </div>
    </div>
    {problem && <p role="alert">{problem}</p>}
    <div className="modal-actions">
      <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      <button disabled={pending}>{pending ? 'Saving…' : 'Add person'}</button>
    </div>
  </form>;
}

/**
 * Filling in a profile: one question per screen, with the bar showing the end.
 *
 * It opens on whatever is still missing and skips what is already there, so
 * finishing a profile is a short series of single answers rather than a wall of
 * inputs. `Edit everything` is always one press away for anyone who would rather
 * see the whole record at once.
 */
export function ProfileEditor({workspaceId, person, organizations, startAt, onSaved, onClose}:{
  workspaceId: string;
  person: Person;
  organizations: Organization[];
  /** Open straight onto this field. Defaults to the first missing one. */
  startAt?: ProfileField['name'];
  onSaved: (person: Person, message: string) => void;
  onClose: () => void;
}) {
  /**
   * The questions to ask, fixed when the editor opens.
   *
   * It must not be recomputed from `person`: each save updates the person, which
   * would drop the answered field out of the queue at the same moment `step`
   * advances past it. The two together skip a question per save and then walk off
   * the end of the list.
   */
  const [queue] = useState(() => {
    const missing = missingFields(person);
    return startAt ? [byName(startAt), ...missing.filter(field => field.name !== startAt)] : missing;
  });
  const [step, setStep] = useState(0);
  const [everything, setEverything] = useState(queue.length === 0);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState('');
  /** Confirmation is shown here rather than only on the page behind: while the
   *  dialog is open, nothing outside it is announced. */
  const [confirmed, setConfirmed] = useState('');
  const keyFor = useKeys();
  const progress = completeness(person);
  const field = queue[step];

  async function save(body: Record<string, unknown>, message: string, advance: boolean) {
    if (Object.keys(body).length === 0) { if (advance) next(); else onClose(); return; }
    setPending(true); setProblem(''); setConfirmed('');
    try {
      const {person: saved, dropped} = await writePerson(
        `workspaces/${workspaceId}/crm/people/${person.id}`, 'PATCH', body,
        keyFor(`person:${person.id}:${JSON.stringify(body)}`),
      );
      const note = dropped.length
        ? ` ${dropped.map(name => byName(name as ProfileField['name']).label).join(' and ')} could not be stored — this workspace's backend has not been updated for them yet.`
        : '';
      onSaved(saved, message + note);
      setConfirmed(message + note);
      if (advance) next();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That did not save.');
    } finally { setPending(false); }
  }

  function next() {
    if (step + 1 < queue.length) setStep(step + 1); else onClose();
  }

  if (everything) return <form className="person-form" onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {};
    for (const row of profileFields) {
      const raw = String(form.get(row.name === 'organizationId' ? 'organizationId' : row.name) ?? '');
      const wire = row.name === 'displayName' ? raw.trim() : forWire(raw);
      if (String(wire ?? '') !== valueOf(person, row)) body[row.name] = wire;
    }
    save(body, 'Profile updated.', false);
  }}>
    <div className="field-grid">
      {profileFields.map(row => <Field key={row.name} field={row} person={person} organizations={organizations} />)}
    </div>
    {confirmed && <p role="status" className="notice">{confirmed}</p>}
    {problem && <p role="alert">{problem}</p>}
    <div className="modal-actions">
      <button type="button" className="secondary" onClick={onClose}>Cancel</button>
      <button disabled={pending}>{pending ? 'Saving…' : 'Save profile'}</button>
    </div>
  </form>;

  // Nothing left to ask. A crash here would take the whole page with it.
  if (!field) return null;

  return <form className="person-form" onSubmit={event => {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get(field.name) ?? '');
    const wire = forWire(raw);
    save(wire === null ? {} : {[field.name]: wire}, `${field.label} saved.`, true);
  }}>
    <div className="steps" aria-hidden="true">
      {queue.map((row, index) => <span key={row.name} className={index <= step ? 'on' : ''} />)}
    </div>
    <p className="small">Question {step + 1} of {queue.length} · {progress.filled} of {progress.total} details on file</p>

    <Field field={field} person={person} organizations={organizations} />
    {field.hint && <p className="small">{field.hint}</p>}

    {confirmed && <p role="status" className="notice">{confirmed}</p>}
    {problem && <p role="alert">{problem}</p>}
    <div className="modal-actions">
      <button type="button" className="secondary" onClick={() => setEverything(true)}>Edit everything</button>
      <button type="button" className="secondary" onClick={next} disabled={pending}>Skip</button>
      <button disabled={pending}>{pending ? 'Saving…' : step + 1 === queue.length ? 'Save and finish' : 'Save and continue'}</button>
    </div>
  </form>;
}
