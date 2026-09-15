'use client';
import { useEffect, useState } from 'react';
import { inviteLimit } from '@/lib/events';
import type { AppConnection } from '@/lib/app-projection';
import { eventsApi, problemMessage } from './client';

/**
 * The host inviting people to their call: connections and outside addresses in one send.
 *
 * Both kinds go in the same box because it is one act. A connection gets an email and an
 * in-app request; an address gets the email. Either way the invitation is the recipient's
 * registration — nobody invited here has to reserve a place before they can walk in.
 */
export default function InviteGuests({eventId}:{eventId: string}) {
  const [connections, setConnections] = useState<AppConnection[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [emails, setEmails] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [sent, setSent] = useState(0);

  /**
   * The people the host is already matched with. A failure here is quiet on purpose:
   * typing addresses still works, and an empty list is a worse reason to show an error
   * than it is to simply offer the box.
   */
  useEffect(() => {
    let live = true;
    fetch('/api/app/connections', {cache:'no-store', headers:{'X-Caffriend-Request':'1'}})
      .then(response => response.ok ? response.json() : [])
      .then(rows => { if (live && Array.isArray(rows)) setConnections(rows.filter((row: AppConnection) => row.isMatched)); })
      .catch(() => { /* the address box is the fallback */ });
    return () => { live = false; };
  }, []);

  const toggle = (id: string) =>
    setChosen(current => current.includes(id) ? current.filter(row => row !== id) : [...current, id]);

  async function invite() {
    setBusy(true); setProblem(''); setSent(0);
    try {
      // Validated again at the boundary; this is only so the host hears about a typo
      // before the send rather than after it.
      const count = chosen.length + emails.split(/[\s,;]+/).filter(Boolean).length;
      await eventsApi(`${eventId}/invite`, {method:'POST', body: JSON.stringify({userIds: chosen, emails})});
      setSent(count); setChosen([]); setEmails('');
    } catch (failure) { setProblem(problemMessage(failure)); }
    finally { setBusy(false); }
  }

  return <section className="event-invite">
    <h3>Invite people</h3>
    {connections.length > 0 && <fieldset>
      <legend>Your connections</legend>
      {connections.map(person => <label className="choice" key={person.userId}>
        <input type="checkbox" checked={chosen.includes(person.userId)} onChange={() => toggle(person.userId)} />
        {person.name}
      </label>)}
    </fieldset>}
    <label>Email addresses
      <textarea rows={3} value={emails} placeholder="sam@example.com, kim@example.com"
        onChange={event => setEmails(event.target.value)} />
    </label>
    <p className="small">Up to {inviteLimit} people at a time. Anyone invited joins without registering separately.</p>
    {problem && <p role="alert">{problem}</p>}
    {sent > 0 && <p role="status">{sent === 1 ? 'Invitation sent.' : `${sent} invitations sent.`}</p>}
    <button type="button" disabled={busy || (!chosen.length && !emails.trim())} onClick={invite}>
      {busy ? 'Sending…' : 'Send invitations'}</button>
  </section>;
}
