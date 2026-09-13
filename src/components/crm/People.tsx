'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Organization, Person } from '@/lib/contracts';
import { useList, Section, Empty, More } from './common';
import { live } from './record-actions';
import { completeness } from './person-profile';
import Modal from './Modal';
import { AddPersonForm } from './PersonForm';
import ImportContacts from './ImportContacts';
import {FormSelect} from '@/components/ui/form-select';

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('');

/** The roster. One card per person, each showing how much of them you actually have. */
export default function People({workspaceId}:{workspaceId:string}) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');

  const people = useList<Person>(`workspaces/${workspaceId}/crm/people${query ? `?search=${encodeURIComponent(query)}` : ''}`);
  const organizations = useList<Organization>(`workspaces/${workspaceId}/crm/organizations`);
  const names = new Map(live(organizations.rows).map(row => [row.id, row.name]));

  // Organization is filtered over loaded rows: the backend's list filter accepts
  // search and pipelineId only, and inventing a query field would be rejected.
  const shown = live(people.rows).filter(row => !organizationId || row.organizationId === organizationId);

  return <>
    <Section title="People" intro="Everyone you are building a relationship with in this workspace." state={people}>
      <div className="toolbar">
        <form className="filters" role="search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); }}>
          <label className="field">
            <span className="field-label">Search by name</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search people" />
          </label>
          <div className="field">
            <span className="field-label">Organization</span>
            <FormSelect aria-label="Organization" value={organizationId} onValueChange={setOrganizationId} options={[{value:'',label:'All organizations'},...live(organizations.rows).map(row => ({value:row.id,label:row.name}))]} />
          </div>
          {/* Secondary: filtering the list is not the page's main action. Adding
              someone is, and only one control should read as primary. */}
          <button className="secondary">Search</button>
          {(query || organizationId) && <button type="button" className="secondary" onClick={() => { setSearch(''); setQuery(''); setOrganizationId(''); }}>Clear</button>}
        </form>
        <button className="secondary" onClick={() => { setImporting(true); setNotice(''); }}>Import contacts</button>
        <button onClick={() => { setAdding(true); setNotice(''); }}>Add a person</button>
      </div>

      {notice && <p role="status" className="notice">{notice}</p>}
      <p className="small" role="status">{shown.length === 0 ? 'No people shown' : `Showing ${shown.length} ${shown.length === 1 ? 'person' : 'people'}`}{people.more ? ' so far' : ''}.</p>

      {shown.length === 0
        ? <Empty>{query || organizationId
            ? 'Nobody matches these filters. Clear them to see everyone in this workspace.'
            : 'No people yet. Add the first person you want to build a relationship with.'}</Empty>
        : <ul className="people-grid">
            {shown.map(person => {
              const progress = completeness(person);
              return <li key={person.id} className="person-card">
                <Link href={`/app/${workspaceId}/people/${person.id}`} className="person-card-link">
                  <span className="avatar" aria-hidden="true">{initials(person.displayName)}</span>
                  <span className="person-card-name">{person.displayName}</span>
                </Link>
                <p className="small person-card-role">
                  {[person.title, person.organizationId ? names.get(person.organizationId) ?? 'Organization unavailable' : null].filter(Boolean).join(' · ') || 'No role recorded'}
                </p>
                <div className="meter" role="img"
                  aria-label={`Profile ${progress.filled} of ${progress.total} details on file`}>
                  <span style={{width: `${Math.round(progress.ratio * 100)}%`}} />
                </div>
                <p className="small">
                  {progress.missing.length === 0
                    ? 'Profile complete'
                    : `Missing ${progress.missing.slice(0, 2).map(field => field.label.toLowerCase()).join(', ')}${progress.missing.length > 2 ? ` +${progress.missing.length - 2}` : ''}`}
                </p>
              </li>;
            })}
          </ul>}
      <More state={people} />
    </Section>

    {adding && <Modal title="Add a person" description="Four details now. The rest is filled in on their page, one question at a time."
      onClose={() => setAdding(false)}>
      <AddPersonForm workspaceId={workspaceId} organizations={live(organizations.rows)}
        onCancel={() => setAdding(false)}
        onCreated={person => { setAdding(false); setNotice(`${person.displayName} was added.`); people.reload(); organizations.reload(); }} />
    </Modal>}
    {importing && <Modal title="Import contacts" description="Upload a CSV or Excel export, review what Caffriend understood, then choose who to add."
      onClose={() => setImporting(false)} wide>
      <ImportContacts workspaceId={workspaceId} onFinished={() => { people.reload(); organizations.reload(); }} />
    </Modal>}
  </>;
}
