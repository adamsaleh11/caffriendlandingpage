'use client';
import {useState} from 'react';
import {api, ApiError} from '@/lib/api';
import type {Person} from '@/lib/contracts';
import {profileFields, sourceLabel} from './person-profile';

type ImportPerson = Partial<Pick<Person, 'displayName'|'title'|'email'|'phone'|'location'|'sourceUrl'|'discoveryReason'|'sourceCategory'>> & {
  organizationName?: string | null;
};
type ImportSkipped = {row?: number | null; reason: string};
type ParseResult = {people?: ImportPerson[]; skipped?: ImportSkipped[]};
type ReviewRow = ImportPerson & {id: string; selected: boolean};
type ImportOutcome = 'added' | 'already_in_network' | 'failed' | 'skipped';
type ResultRow = {id: string; name: string; status: ImportOutcome; message?: string};
type ImportField = 'displayName'|'title'|'organizationName'|'email'|'phone'|'location'|'sourceUrl'|'discoveryReason';

const maxBytes = 5 * 1024 * 1024;
const accepted = ['csv', 'xlsx', 'xls'];
const fields: ImportField[] = [
  'displayName', 'title', 'organizationName', 'email', 'phone', 'location', 'sourceUrl', 'discoveryReason',
];
const labels: Record<string, string> = {
  displayName: 'Name',
  organizationName: 'Organization',
};
const fieldLabel = (name: string) => labels[name] ?? profileFields.find(field => field.name === name)?.label ?? name;
const fieldType = (name: string) => profileFields.find(field => field.name === name)?.kind === 'email'
  ? 'email' : profileFields.find(field => field.name === name)?.kind === 'url' ? 'url' : 'text';
const normalize = (value: unknown) => String(value ?? '').trim();

async function parseFile(workspaceId: string, file: File) {
  const body = new FormData();
  body.set('file', file);
  const response = await fetch(`/api/crm/workspaces/${workspaceId}/crm/prospects/import/parse`, {
    method: 'POST',
    headers: {'X-Caffriend-Request': '1', 'X-Idempotency-Key': crypto.randomUUID()},
    body,
    cache: 'no-store',
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) as {error?: string} & ParseResult : {};
  if (!response.ok) throw new ApiError(response.status, json.error || 'That file could not be read.');
  return json;
}

async function ingest(workspaceId: string, row: ReviewRow) {
  const body: Record<string, unknown> = {sourceCategory: normalize(row.sourceCategory) || 'IMPORTED'};
  for (const name of fields) {
    const value = normalize(row[name as keyof ReviewRow]);
    if (value) body[name] = value;
  }
  return api<{status?: string; person?: Person; message?: string}>(`workspaces/${workspaceId}/crm/prospects/ingest`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {'X-Idempotency-Key': crypto.randomUUID()},
  });
}

export default function ImportContacts({workspaceId, onFinished}:{workspaceId: string; onFinished: () => void}) {
  const [step, setStep] = useState<'choose'|'review'|'results'>('choose');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState('');
  const [fileProblem, setFileProblem] = useState('');
  const [pending, setPending] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [skipped, setSkipped] = useState<ImportSkipped[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);

  function choose(next: File | null) {
    setFile(next);
    setProblem('');
    setFileProblem('');
    if (!next) return;
    const extension = next.name.split('.').pop()?.toLowerCase() ?? '';
    if (!accepted.includes(extension)) setFileProblem('Choose a CSV or Excel file.');
    else if (next.size > maxBytes) setFileProblem('Choose a file smaller than 5 MB.');
  }

  async function review() {
    if (!file) { setProblem('Choose a CSV or Excel file.'); return; }
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!accepted.includes(extension) || file.size > maxBytes) return;
    setPending(true); setProblem('');
    try {
      const parsed = await parseFile(workspaceId, file);
      setRows((parsed.people ?? []).map((row, index) => ({
        id: `row-${index}`,
        sourceCategory: 'IMPORTED',
        ...row,
        selected: !!normalize(row.displayName),
      })));
      setSkipped(parsed.skipped ?? []);
      setStep('review');
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That file could not be read.');
    } finally { setPending(false); }
  }

  function update(id: string, name: string, value: string) {
    setRows(current => current.map(row => {
      if (row.id !== id) return row;
      const next = {...row, [name]: value};
      if (name === 'displayName' && !normalize(value)) next.selected = false;
      return next;
    }));
  }

  function toggle(id: string, selected: boolean) {
    setRows(current => current.map(row => row.id === id ? {...row, selected} : row));
  }

  async function importSelected() {
    setPending(true); setProblem('');
    const selected = rows.filter(row => row.selected && normalize(row.displayName));
    const next: ResultRow[] = rows.filter(row => !row.selected).map(row => ({
      id: row.id,
      name: normalize(row.displayName) || 'Unnamed row',
      status: 'skipped',
      message: 'Not imported',
    }));
    let index = 0;
    async function worker() {
      for (;;) {
        const row = selected[index++];
        if (!row) return;
        try {
          const result = await ingest(workspaceId, row);
          next.push({
            id: row.id,
            name: normalize(row.displayName),
            status: result.status === 'already_in_network' ? 'already_in_network' : 'added',
          });
        } catch (error) {
          next.push({
            id: row.id,
            name: normalize(row.displayName),
            status: 'failed',
            message: error instanceof ApiError ? error.message : 'That contact was not imported.',
          });
        }
      }
    }
    await Promise.all(Array.from({length: Math.min(3, selected.length)}, worker));
    setResults(next);
    setStep('results');
    setPending(false);
    onFinished();
  }

  if (step === 'choose') return <div className="person-form">
    <div className="field wide">
      <label className="field-label" htmlFor="contact-import-file">Contact file</label>
      <input id="contact-import-file" type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={event => choose(event.currentTarget.files?.[0] ?? null)} />
      <span className="small">CSV or Excel, up to 5 MB.</span>
    </div>
    {(fileProblem || problem) && <p role="alert">{fileProblem || problem}</p>}
    <div className="modal-actions">
      <button disabled={pending || !!fileProblem || !file} onClick={review}>{pending ? 'Reading...' : 'Review contacts'}</button>
    </div>
  </div>;

  if (step === 'review') return <div className="person-form">
    <h3>Review contacts</h3>
    <div className="table-wrap">
      <table>
        <thead><tr><th>Import</th>{fields.map(name => <th key={name}>{fieldLabel(name)}</th>)}<th>Source</th></tr></thead>
        <tbody>{rows.map((row, rowIndex) => {
          const name = normalize(row.displayName);
          return <tr key={row.id}>
            <td><label className="inline-field">
              <input type="checkbox" checked={row.selected} disabled={!name}
                aria-label={`Import ${name || `row ${rowIndex + 1}`}`}
                onChange={event => toggle(row.id, event.currentTarget.checked)} />
            </label></td>
            {fields.map(field => <td key={field}>
              {field === 'discoveryReason'
                ? <textarea aria-label={`${fieldLabel(field)} for row ${rowIndex + 1}`} rows={2} maxLength={2000} readOnly
                    value={normalize(row[field])} onChange={event => update(row.id, field, event.currentTarget.value)} />
                : <input aria-label={`${fieldLabel(field)} for row ${rowIndex + 1}`} type={fieldType(field)}
                    value={normalize(row[field])} onChange={event => update(row.id, field, event.currentTarget.value)} />}
            </td>)}
            <td>{sourceLabel(normalize(row.sourceCategory) || 'IMPORTED')}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    {skipped.length > 0 && <section>
      <button type="button" className="secondary" aria-expanded={showSkipped} onClick={() => setShowSkipped(value => !value)}>Skipped rows ({skipped.length})</button>
      {showSkipped && 
      <ul>{skipped.map((row, index) => <li key={index}>Row {row.row ?? index + 1}: {row.reason}</li>)}</ul>
      }
    </section>}
    {problem && <p role="alert">{problem}</p>}
    <div className="modal-actions">
      <button type="button" className="secondary" onClick={() => setStep('choose')}>Back</button>
      <button disabled={pending || rows.every(row => !row.selected)} onClick={importSelected}>{pending ? 'Importing...' : 'Import selected'}</button>
    </div>
  </div>;

  return <div className="person-form">
    <h3>Import results</h3>
    <ul className="claims">
      {results.map(row => <li key={row.id}>
        <strong>{row.name}</strong>: {row.message ?? (row.status === 'already_in_network' ? 'Already in your network' : row.status === 'failed' ? 'Failed' : 'Added')}
      </li>)}
    </ul>
  </div>;
}
