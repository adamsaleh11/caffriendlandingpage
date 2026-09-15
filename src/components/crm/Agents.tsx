'use client';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { agentScopeGroups, agentScopeLabels, agentScopeNames, immediateAgentScopes, auditActions, actorLabels, type Agent, type AgentScope, type AuditEvent } from '@/lib/contracts';
import { useKeys, useList, Section, Empty, More } from './common';

type Connection = { id: string; clientName?: string | null; scopes?: string[] | null; createdAt?: string; expiresAt?: string | null; revokedAt?: string | null };
type Registered = { id: string; name: string; scopes: string[]; redirectUris: string[] };

export default function Agents({workspaceId}:{workspaceId:string}) {
  const agents = useList<Agent>(`workspaces/${workspaceId}/crm/agents`);
  const connections = useList<Connection>(`workspaces/${workspaceId}/oauth/connections`);
  const events = useList<AuditEvent & {actorAgentId?: string|null}>(`workspaces/${workspaceId}/crm/audit-events`);

  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string>();
  const [revoking, setRevoking] = useState<string>();
  /**
   * Held in component state only, for one render of one session. It is never written
   * to local storage, a URL, analytics or any cache, and is cleared on acknowledgement.
   */
  const [issued, setIssued] = useState<Registered>();
  const [copied, setCopied] = useState(false);
  const keyFor = useKeys();

  const none = (agents.rows?.length ?? 0) === 0 && (connections.rows?.length ?? 0) === 0;
  const agentActivity = (events.rows ?? []).filter(row => row.actorType === 'AGENT').slice(0, 25);

  async function register(form: FormData) {
    const name = String(form.get('name') ?? '').trim();
    const redirectUri = String(form.get('redirectUri') ?? '').trim();
    const scopes = form.getAll('scopes').map(String);
    if (!scopes.length) { setProblem('Choose at least one permission for this agent.'); return; }
    setPending(true); setProblem(''); setNotice('');
    try {
      const result = await api<Registered>(`workspaces/${workspaceId}/oauth/clients`, {
        method:'POST',
        body: JSON.stringify({name, redirectUris:[redirectUri], scopes}),
        headers:{'X-Idempotency-Key': keyFor(`agent:${name}:${redirectUri}:${scopes.join(',')}`)},
      });
      setIssued(result); setOpen(false); setCopied(false);
      agents.reload(); connections.reload();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That agent was not created.');
    } finally { setPending(false); }
  }

  async function revoke(id: string) {
    setBusy(id); setProblem(''); setNotice('');
    try {
      await api(`workspaces/${workspaceId}/oauth/connections/${id}/revoke`, {method:'POST', body:'{}', headers:{'X-Idempotency-Key': keyFor(`revoke:${id}`)}});
      setNotice('That connection was revoked. The agent can no longer act in this workspace.');
      setRevoking(undefined); connections.reload();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That connection was not revoked.');
      connections.reload();
    } finally { setBusy(undefined); }
  }

  return <>
    {none && !dismissed && !issued && <section className="card optional">
      <h2>Connecting an agent is optional</h2>
      <p>Caffriend works fully without one. An agent lets a compatible AI host — ChatGPT, or anything speaking remote MCP — propose people, engagements and meetings. Everything it proposes waits in your Inbox for your decision.</p>
      <button onClick={() => setOpen(true)}>Set up an agent</button>
      <button className="secondary" onClick={() => setDismissed(true)}>Not now</button>
    </section>}

    {issued && <section className="card credential" role="group" aria-label="New agent credential">
      <h2>Copy this client ID now</h2>
      <p><strong>{issued.name}</strong> was created. This is the only time Caffriend shows you the client ID here. It is held in this page only — not saved to your browser, the address bar, or any log.</p>
      <p className="code"><code>{issued.id}</code></p>
      <button onClick={async () => { try { await navigator.clipboard.writeText(issued.id); setCopied(true); } catch { setCopied(false); setProblem('Copying failed. Select the client ID above and copy it manually.'); } }}>Copy client ID</button>
      {copied && <span role="status"> Copied.</span>}
      <p className="small">Permissions granted: {issued.scopes.map(scope => agentScopeLabels[scope as AgentScope] ?? scope).join(', ')}</p>
      {/* Recorded gap: this backend issues a public client with PKCE and no client secret. */}
      <p role="note" className="small">No client secret is issued. This agent authenticates as a public client using PKCE at the authorization endpoint below.</p>
      <button className="secondary" onClick={() => { setIssued(undefined); setNotice('Agent created.'); }}>I have saved it</button>
    </section>}

    <Section title="Agents" intro="Connected agents, what they may do, and what they have done." state={agents}>
      {notice && <p role="status" className="notice">{notice}</p>}
      {problem && !open && <p role="alert">{problem}</p>}

      <h3>Connections</h3>
      {connections.error && !connections.rows && <p role="alert">{connections.error.message} <button className="secondary" onClick={connections.reload}>Try again</button></p>}
      {!connections.rows && !connections.error && <p role="status">Loading connections…</p>}
      {connections.rows && connections.rows.length === 0 && <Empty>No agent is connected to this workspace.</Empty>}
      {(connections.rows ?? []).map(connection => <article key={connection.id} className="connection">
        <h4>{connection.clientName || 'Connected agent'}</h4>
        <dl>
          <dt>Permissions</dt><dd>{connection.scopes?.length ? connection.scopes.map(scope => agentScopeLabels[scope as AgentScope] ?? scope).join(', ') : 'Permissions unavailable'}</dd>
          <dt>Connected</dt><dd>{connection.createdAt ? new Date(connection.createdAt).toLocaleString() : 'Unknown'}</dd>
          <dt>Status</dt><dd>{connection.revokedAt ? `Revoked on ${new Date(connection.revokedAt).toLocaleString()}` : 'Active'}</dd>
        </dl>
        {!connection.revokedAt && (revoking === connection.id
          ? <div role="group" aria-label="Confirm revoke" className="confirm">
              <p>Revoke this connection? The agent immediately loses access. Records it already created stay in your workspace, and proposals it made stay in your Inbox.</p>
              <button disabled={busy === connection.id} onClick={() => revoke(connection.id)}>{busy === connection.id ? 'Revoking…' : 'Yes, revoke'}</button>
              <button className="secondary" onClick={() => setRevoking(undefined)}>Keep connection</button>
            </div>
          : <button className="secondary" onClick={() => setRevoking(connection.id)}>Revoke</button>)}
      </article>)}
      <More state={connections} />

      <h3>Create an agent</h3>
      {open
        ? <form onSubmit={event => { event.preventDefault(); register(new FormData(event.currentTarget)); }}>
            <label>Name<input name="name" required maxLength={200} autoFocus /><span className="small">How this agent appears in your Inbox and audit history.</span></label>
            <label>Redirect URI<input name="redirectUri" type="url" required maxLength={2048} placeholder="https://" /><span className="small">Supplied by the host you are connecting. Must be https.</span></label>
            <fieldset className="permissions">
              <legend>What may this agent do?</legend>
              <p className="small">Pick only what this agent needs. You can revoke it at any time.</p>
              {agentScopeGroups.map(group => <div key={group.title} className="permission-group">
                <h4>{group.title}</h4>
                <p className="small group-note">{group.note}</p>
                {group.scopes.map(scope => <label key={scope} className="choice permission">
                  <input type="checkbox" name="scopes" value={scope} />
                  <span className="permission-text">
                    <span className="permission-name">
                      {agentScopeLabels[scope]}
                      {immediateAgentScopes.includes(scope) && <span className="badge">No approval needed</span>}
                    </span>
                    <span className="small">{agentScopeNames[scope]}</span>
                  </span>
                </label>)}
              </div>)}
            </fieldset>
            {/* Recorded gap: the backend accepts name, redirectUris and scopes only. */}
            <p role="note" className="small">A per-day request limit is not yet enforceable: this backend records no daily limit on an agent. Revoke a connection to stop an agent immediately.</p>
            {problem && <p role="alert">{problem}</p>}
            <button disabled={pending}>{pending ? 'Creating…' : 'Create agent'}</button>
            <button type="button" className="secondary" onClick={() => { setOpen(false); setProblem(''); }}>Cancel</button>
          </form>
        : <button onClick={() => setOpen(true)}>Create an agent</button>}

      <h3>Connect a remote MCP host</h3>
      <p>Any host that speaks remote MCP over OAuth can connect. In the host, add a remote MCP server and give it this workspace&apos;s authorization details; it discovers the rest automatically.</p>
      <dl>
        <dt>Discovery</dt><dd><code>/.well-known/oauth-authorization-server</code> on the Caffriend API origin.</dd>
        <dt>Authorization</dt><dd>You approve the connection on a Caffriend consent screen, where the requested permissions are listed before you allow it.</dd>
        <dt>Client type</dt><dd>Public client with PKCE. No client secret is issued.</dd>
      </dl>

      <h3>Recent agent activity</h3>
      {events.error && !events.rows && <p role="alert">Unable to load agent activity. <button className="secondary" onClick={events.reload}>Try again</button></p>}
      {!events.rows && !events.error && <p role="status">Loading agent activity…</p>}
      {events.rows && agentActivity.length === 0 && <Empty>No agent has acted in this workspace yet.</Empty>}
      {agentActivity.length > 0 && <table className="records">
        <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Did what</th><th scope="col">To</th></tr></thead>
        <tbody>{agentActivity.map(row => <tr key={row.id}>
          <td>{new Date(row.createdAt).toLocaleString()}</td>
          <td>{actorLabels[row.actorType] ?? row.actorType}</td>
          <td>{auditActions[row.action] ?? row.action}</td>
          <td>{row.targetType}</td>
        </tr>)}</tbody>
      </table>}
    </Section>
  </>;
}
