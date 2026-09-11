'use client';
import { useState } from 'react';
import { actorLabels, auditActions, type Agent, type Approval, type AuditEvent } from '@/lib/contracts';
import { useList, Section, Empty, More } from './common';

type Event = AuditEvent & { actorMemberId?: string|null; actorAgentId?: string|null; approvalId?: string|null };

export default function Audit({workspaceId}:{workspaceId:string}) {
  const events = useList<Event>(`workspaces/${workspaceId}/crm/audit-events`);
  const approvals = useList<Approval>(`workspaces/${workspaceId}/crm/approvals`);
  const agents = useList<Agent>(`workspaces/${workspaceId}/crm/agents`);
  const [raw, setRaw] = useState<string>();

  const agentNames = new Map((agents.rows ?? []).map(row => [row.id, row.name]));
  const approvalsById = new Map((approvals.rows ?? []).map(row => [row.id, row]));
  const ordered = [...(events.rows ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return <Section title="History" intro="Every change to this workspace, who made it and why." state={events}>
    {ordered.length === 0 && <Empty>Nothing has happened in this workspace yet.</Empty>}
    <ol className="audit">
      {ordered.map(event => {
        const approval = event.approvalId ? approvalsById.get(event.approvalId) : undefined;
        return <li key={event.id}>
          <p className="entry">
            <strong>{auditActions[event.action] ?? event.action}</strong>
            {' — '}{actorLabels[event.actorType] ?? event.actorType}
            {event.actorAgentId ? ` ${agentNames.get(event.actorAgentId) ?? '(agent)'}` : ''}
            {' on '}<time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
          </p>
          <p className="small">Affected {event.targetType}.</p>
          {approval && <p className="small">
            Carried out under a proposal that was {approval.status.toLowerCase()}
            {approval.reason ? `, because: ${approval.reason}` : ''}.
          </p>}
          {/*
            Recorded gap: this backend's audit projection carries no before/after
            values, so the change itself cannot be shown. Saying so is honest;
            reconstructing a diff from current records would invent history.
          */}
          <p className="small">The values before and after this change are not recorded in the audit trail.</p>
          <button className="secondary small" aria-expanded={raw === event.id} onClick={() => setRaw(raw === event.id ? undefined : event.id)}>
            {raw === event.id ? 'Hide record' : 'Show record'}
          </button>
          {raw === event.id && <pre>{JSON.stringify(event, null, 2)}</pre>}
        </li>;
      })}
    </ol>
    <More state={events} />
  </Section>;
}
