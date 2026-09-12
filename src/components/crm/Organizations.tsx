'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { Organization, Person } from '@/lib/contracts';
import { useKeys, useList, Section, Empty, More } from './common';
import Modal from './Modal';
import { ArchiveButton, editRecord, live, problemText } from './record-actions';

/** The one form, used to add an organization and to correct one. */
function OrganizationForm({organization, pending, problem, onSubmit, onCancel}:{
  organization?: Organization;
  pending: boolean;
  problem: string;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  return <form onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const domain = String(data.get('domain') ?? '').trim();
    // On an edit an emptied domain is a deliberate clearing, not an omission.
    onSubmit(organization ? {name, domain: domain || null} : domain ? {name, domain} : {name});
  }}>
    <label>Name<input name="name" required maxLength={200} autoFocus defaultValue={organization?.name ?? ''} /></label>
    <label>Domain<input name="domain" maxLength={253} placeholder="example.com" defaultValue={organization?.domain ?? ''} /></label>
    {problem && <p role="alert">{problem}</p>}
    <button disabled={pending}>{pending ? 'Saving…' : organization ? 'Save changes' : 'Add organization'}</button>
    <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
  </form>;
}

export default function Organizations({workspaceId}:{workspaceId:string}) {
  const organizations = useList<Organization>(`workspaces/${workspaceId}/crm/organizations`);
  const people = useList<Person>(`workspaces/${workspaceId}/crm/people`);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Organization>();
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const keyFor = useKeys();

  const rows = live(organizations.rows);
  const counts = new Map<string, number>();
  for (const person of live(people.rows)) if (person.organizationId) counts.set(person.organizationId, (counts.get(person.organizationId) ?? 0) + 1);

  async function add(body: Record<string, unknown>) {
    setPending(true); setProblem(''); setNotice('');
    try {
      await api(`workspaces/${workspaceId}/crm/organizations`, {method:'POST', body: JSON.stringify(body), headers:{'X-Idempotency-Key': keyFor(`org:${JSON.stringify(body)}`)}});
      setOpen(false); setNotice(`${body.name} was added.`); organizations.reload();
    } catch (error) { setProblem(problemText(error, 'That organization was not added.')); }
    finally { setPending(false); }
  }

  async function save(organization: Organization, body: Record<string, unknown>) {
    setPending(true); setProblem(''); setNotice('');
    try {
      await editRecord<Organization>(workspaceId, 'organizations', organization.id, body);
      setEditing(undefined); setNotice(`${body.name} was updated.`); organizations.reload();
    } catch (error) { setProblem(problemText(error, 'That change did not save.')); }
    finally { setPending(false); }
  }

  return <Section title="Organizations" intro="The companies the people in this workspace belong to." state={organizations}>
    {notice && <p role="status" className="notice">{notice}</p>}
    {rows.length === 0
      ? <Empty>No organizations yet. Add one to group the people you are tracking.</Empty>
      : <table className="records">
          <thead><tr><th scope="col">Organization</th><th scope="col">Domain</th><th scope="col">People</th><th scope="col">Actions</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id}>
            <th scope="row">{row.name}</th>
            <td>{row.domain || '—'}</td>
            <td>{counts.get(row.id) ?? 0}</td>
            <td className="row-actions">
              <button type="button" className="secondary small-button" onClick={() => { setEditing(row); setProblem(''); setNotice(''); }}>
                Edit<span className="sr-only"> {row.name}</span>
              </button>
              <ArchiveButton workspaceId={workspaceId} resource="organizations" id={row.id} name={row.name} what="organization"
                keeps={(counts.get(row.id) ?? 0) > 0
                  ? `${counts.get(row.id)} ${counts.get(row.id) === 1 ? 'person stays' : 'people stay'} in this workspace. They will simply show no organization.`
                  : undefined}
                onArchived={() => { setNotice(`${row.name} was archived.`); organizations.reload(); people.reload(); }}
                onProblem={setProblem} />
            </td>
          </tr>)}</tbody>
        </table>}
    <More state={organizations} />
    {problem && !open && !editing && <p role="alert">{problem}</p>}
    {open
      ? <OrganizationForm pending={pending} problem={problem} onSubmit={add} onCancel={() => { setOpen(false); setProblem(''); }} />
      : <button onClick={() => { setOpen(true); setProblem(''); setNotice(''); }}>Add an organization</button>}

    {editing && <Modal title="Edit this organization" description="Correct the name or the domain. The people in it are untouched."
      onClose={() => { setEditing(undefined); setProblem(''); }}>
      <OrganizationForm organization={editing} pending={pending} problem={problem}
        onSubmit={body => save(editing, body)}
        onCancel={() => { setEditing(undefined); setProblem(''); }} />
    </Modal>}
  </Section>;
}
