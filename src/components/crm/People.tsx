'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type { Organization, Person } from '@/lib/contracts';
import { useKeys, useList, Section, Empty, More } from './common';

/**
 * How a person entered the workspace. The backend stores this as free text, but
 * MANUAL carries a specific meaning in its rights model: a person a member typed
 * in themselves may be contacted without reviewed claims. So it is offered
 * explicitly rather than left to whatever a member happens to type.
 */
const sourceCategories = [
  {value:'MANUAL', label:'I added them myself', hint:'Someone you met or found yourself. You may contact them; export and republication still need reviewed sources.'},
  {value:'REFERRAL', label:'A referral', hint:'Introduced to you by someone else.'},
  {value:'EVENT', label:'An event', hint:'Met at a conference, meetup or similar.'},
  {value:'IMPORTED', label:'Imported from a document', hint:'Came from a file or dataset. Outreach stays blocked until its source rights are reviewed.'},
];

export default function People({workspaceId}:{workspaceId:string}) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const keyFor = useKeys();

  const people = useList<Person>(`workspaces/${workspaceId}/crm/people${query ? `?search=${encodeURIComponent(query)}` : ''}`);
  const organizations = useList<Organization>(`workspaces/${workspaceId}/crm/organizations`);
  const names = new Map((organizations.rows ?? []).map(row => [row.id, row.name]));

  // Organization is filtered over loaded rows: the backend's list filter accepts
  // search and pipelineId only, and inventing a query field would be rejected.
  const shown = (people.rows ?? []).filter(row => !organizationId || row.organizationId === organizationId);

  async function create(form: FormData) {
    setPending(true); setProblem(''); setNotice('');
    const body: Record<string, unknown> = {
      displayName: String(form.get('displayName') ?? '').trim(),
      sourceCategory: String(form.get('sourceCategory') ?? ''),
    };
    for (const field of ['title','location','email','phone'] as const) {
      const value = String(form.get(field) ?? '').trim();
      if (value) body[field] = value;
    }
    const organization = String(form.get('organizationId') ?? '');
    if (organization) body.organizationId = organization;
    try {
      await api<Person>(`workspaces/${workspaceId}/crm/people`, {
        method:'POST', body: JSON.stringify(body),
        headers:{'X-Idempotency-Key': keyFor(`person:${JSON.stringify(body)}`)},
      });
      setAdding(false); setNotice(`${body.displayName} was added.`);
      people.reload();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That did not save. Try again.');
    } finally { setPending(false); }
  }

  return <>
    <Section title="People" intro="Everyone you are building a relationship with in this workspace." state={people}>
      <form className="filters" role="search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); }}>
        <label>Search by name<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search people" /></label>
        <label>Organization
          <select value={organizationId} onChange={event => setOrganizationId(event.target.value)}>
            <option value="">All organizations</option>
            {(organizations.rows ?? []).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </label>
        <button>Search</button>
        {(query || organizationId) && <button type="button" className="secondary" onClick={() => { setSearch(''); setQuery(''); setOrganizationId(''); }}>Clear</button>}
      </form>

      {notice && <p role="status" className="notice">{notice}</p>}
      <p className="small" role="status">{shown.length === 0 ? 'No people shown' : `Showing ${shown.length} ${shown.length === 1 ? 'person' : 'people'}`}{people.more ? ' so far' : ''}.</p>

      {shown.length === 0
        ? <Empty>{query || organizationId
            ? 'Nobody matches these filters. Clear them to see everyone in this workspace.'
            : 'No people yet. Add the first person you want to build a relationship with.'}</Empty>
        : <table className="records">
            <caption className="small">People in this workspace{organizationId ? `, at ${names.get(organizationId) ?? 'the selected organization'}` : ''}.</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Organization</th><th scope="col">How they were added</th></tr></thead>
            <tbody>
              {shown.map(person => <tr key={person.id}>
                <th scope="row"><Link href={`/app/${workspaceId}/people/${person.id}`}>{person.displayName}</Link></th>
                <td>{person.title || '—'}</td>
                <td>{person.organizationId ? names.get(person.organizationId) ?? 'Organization unavailable' : '—'}</td>
                <td>{sourceCategories.find(row => row.value === person.sourceCategory)?.label ?? person.sourceCategory}</td>
              </tr>)}
            </tbody>
          </table>}
      <More state={people} />
    </Section>

    <section className="card">
      <div className="card-head">
        <h2>Add a person</h2>
        {/* The action lives in the header: the card is the action, so it needs no second title. */}
        <button className={adding ? 'secondary' : ''} aria-expanded={adding}
          onClick={() => { if (adding) { setAdding(false); setProblem(''); } else { setAdding(true); setNotice(''); } }}>
          {adding ? 'Cancel' : 'Add a person'}
        </button>
      </div>
      {adding
        ? <form onSubmit={event => { event.preventDefault(); create(new FormData(event.currentTarget)); }}>
            <label>Name<input name="displayName" required maxLength={200} autoFocus /></label>
            <label>Role<input name="title" maxLength={200} /></label>
            <label>Organization
              <select name="organizationId" defaultValue="">
                <option value="">No organization</option>
                {(organizations.rows ?? []).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </label>
            <label>Email<input name="email" type="email" maxLength={320} /></label>
            <label>Phone<input name="phone" maxLength={50} /></label>
            <label>Location<input name="location" maxLength={200} /></label>
            <fieldset>
              <legend>How did you get this person&apos;s details?</legend>
              {/* Recorded because it decides what this person may later be used for. */}
              {sourceCategories.map((row, index) => <label key={row.value} className="choice">
                <input type="radio" name="sourceCategory" value={row.value} required defaultChecked={index === 0} />
                {row.label}<span className="small">{row.hint}</span>
              </label>)}
            </fieldset>
            {problem && <p role="alert">{problem}</p>}
            <button disabled={pending}>{pending ? 'Saving…' : 'Add person'}</button>
          </form>
        : null}
    </section>
  </>;
}
