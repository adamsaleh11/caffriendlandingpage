'use client';
import { useMemo, useState } from 'react';
import { actorLabels, auditActions, targetLabels, describeAction, type Agent, type Approval, type AuditEvent } from '@/lib/contracts';
import { useList, Section, Empty, More } from './common';

type Event = AuditEvent & { actorMemberId?: string|null; actorAgentId?: string|null; approvalId?: string|null };

/** Same-day and yesterday entries read better relative; older ones need the date. */
function dayLabel(iso: string) {
  const when = new Date(iso);
  const today = new Date();
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(today) - midnight(when)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return when.toLocaleDateString(undefined, {weekday:'long', day:'numeric', month:'long', year: when.getFullYear() === today.getFullYear() ? undefined : 'numeric'});
}

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});

type Filter = 'all' | 'people' | 'agents' | 'system';
const filters: {key: Filter; label: string}[] = [
  {key:'all', label:'Everything'},
  {key:'people', label:'People'},
  {key:'agents', label:'Agents'},
  {key:'system', label:'Caffriend'},
];
const bucket = (actorType: string): Filter =>
  actorType === 'AGENT' ? 'agents' : actorType === 'SYSTEM' ? 'system' : 'people';

export default function Audit({workspaceId}:{workspaceId:string}) {
  const events = useList<Event>(`workspaces/${workspaceId}/crm/audit-events`);
  const approvals = useList<Approval>(`workspaces/${workspaceId}/crm/approvals`);
  const agents = useList<Agent>(`workspaces/${workspaceId}/crm/agents`);
  const [raw, setRaw] = useState<string>();
  const [filter, setFilter] = useState<Filter>('all');

  const agentNames = new Map((agents.rows ?? []).map(row => [row.id, row.name]));
  const approvalsById = new Map((approvals.rows ?? []).map(row => [row.id, row]));

  /** Newest first, then cut into day groups so a long trail stays scannable. */
  const days = useMemo(() => {
    const ordered = [...(events.rows ?? [])]
      .filter(event => filter === 'all' || bucket(event.actorType) === filter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const groups: {label: string; rows: Event[]}[] = [];
    for (const event of ordered) {
      const label = dayLabel(event.createdAt);
      if (groups[groups.length - 1]?.label !== label) groups.push({label, rows: []});
      groups[groups.length - 1].rows.push(event);
    }
    return groups;
  }, [events.rows, filter]);

  const total = (events.rows ?? []).length;

  return <Section title="History" intro="Every change to this workspace, who made it and when." state={events}>
    {total === 0 ? <Empty>Nothing has happened in this workspace yet.</Empty> : <>
      <div className="audit-filters" role="group" aria-label="Show changes by">
        {filters.map(option => <button
          key={option.key}
          className={`secondary small-button${filter === option.key ? ' selected' : ''}`}
          aria-pressed={filter === option.key}
          onClick={() => setFilter(option.key)}
        >{option.label}</button>)}
      </div>

      {days.length === 0 && <Empty>No changes by {filters.find(f => f.key === filter)?.label.toLowerCase()} in what has been loaded.</Empty>}

      {days.map(day => <div className="audit-day" key={day.label}>
        <h2 className="audit-date">{day.label}</h2>
        <ol className="audit">
          {day.rows.map(event => {
            const approval = event.approvalId ? approvalsById.get(event.approvalId) : undefined;
            const actor = event.actorAgentId
              ? (agentNames.get(event.actorAgentId) ?? 'An agent')
              : (actorLabels[event.actorType] ?? event.actorType);
            return <li key={event.id}>
              <p className="entry">
                <time className="audit-time" dateTime={event.createdAt} title={new Date(event.createdAt).toLocaleString()}>{time(event.createdAt)}</time>
                <span>
                  <strong>{auditActions[event.action] ?? describeAction(event.action)}</strong>
                  {' · '}{actor}
                  {' · '}{targetLabels[event.targetType] ?? event.targetType}
                </span>
              </p>
              {approval && <p className="small">
                Carried out under a proposal that was {approval.status.toLowerCase()}
                {approval.reason ? `, because: ${approval.reason}` : ''}.
              </p>}
              <button className="link-button small" aria-expanded={raw === event.id} onClick={() => setRaw(raw === event.id ? undefined : event.id)}>
                {raw === event.id ? 'Hide details' : 'Details'}
              </button>
              {raw === event.id && <pre>{JSON.stringify(event, null, 2)}</pre>}
            </li>;
          })}
        </ol>
      </div>)}

      {/*
        Recorded gap: this backend's audit projection carries no before/after
        values, so the change itself cannot be shown. Saying so once at the foot
        of the page is honest; repeating it on every row drowned out the history,
        and reconstructing a diff from current records would invent it.
      */}
      <p className="small audit-gap">The trail records what happened and who did it. The values before and after each change are not kept, so they cannot be shown.</p>
    </>}
    <More state={events} />
  </Section>;
}
