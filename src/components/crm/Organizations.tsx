'use client';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Organization, Person } from '@/lib/contracts';
import { useKeys, useList, Section, Empty, More } from './common';

export default function Organizations({workspaceId}:{workspaceId:string}) {
  const organizations = useList<Organization>(`workspaces/${workspaceId}/crm/organizations`);
  const people = useList<Person>(`workspaces/${workspaceId}/crm/people`);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState('');
  const keyFor = useKeys();

  const counts = new Map<string, number>();
  for (const person of people.rows ?? []) if (person.organizationId) counts.set(person.organizationId, (counts.get(person.organizationId) ?? 0) + 1);

  return <Section title="Organizations" intro="The companies the people in this workspace belong to." state={organizations}>
    {(organizations.rows?.length ?? 0) === 0
      ? <Empty>No organizations yet. Add one to group the people you are tracking.</Empty>
      : <table className="records">
          <thead><tr><th scope="col">Organization</th><th scope="col">Domain</th><th scope="col">People</th></tr></thead>
          <tbody>{(organizations.rows ?? []).map(row => <tr key={row.id}>
            <th scope="row">{row.name}</th>
            <td>{row.domain || '—'}</td>
            <td>{counts.get(row.id) ?? 0}</td>
          </tr>)}</tbody>
        </table>}
    <More state={organizations} />
    {open
      ? <form onSubmit={async event => { event.preventDefault();
          const data = new FormData(event.currentTarget);
          const body: Record<string,unknown> = {name: String(data.get('name') ?? '').trim()};
          const domain = String(data.get('domain') ?? '').trim();
          if (domain) body.domain = domain;
          setPending(true); setProblem('');
          try { await api(`workspaces/${workspaceId}/crm/organizations`, {method:'POST', body: JSON.stringify(body), headers:{'X-Idempotency-Key': keyFor(`org:${JSON.stringify(body)}`)}}); setOpen(false); organizations.reload(); }
          catch (error) { setProblem(error instanceof ApiError ? error.message : 'That organization was not added.'); }
          finally { setPending(false); }
        }}>
          <label>Name<input name="name" required maxLength={200} autoFocus /></label>
          <label>Domain<input name="domain" maxLength={253} placeholder="example.com" /></label>
          {problem && <p role="alert">{problem}</p>}
          <button disabled={pending}>{pending ? 'Saving…' : 'Add organization'}</button>
          <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
        </form>
      : <button onClick={() => setOpen(true)}>Add an organization</button>}
  </Section>;
}
