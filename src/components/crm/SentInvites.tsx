'use client';
import {useRows} from './common';

/**
 * What happened to the invitations you sent.
 *
 * An invitation is a question asked on your behalf, and until it is answered
 * the sender has no way of knowing where it stands short of asking the person
 * they invited — which is the errand the invitation existed to save. So each
 * row leads with the answer: accepted and when, declined, or still waiting.
 */

export type SentInvite = {
  id: string;
  recipientEmail: string;
  recipientName?: string;
  purpose?: string;
  decision: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  decidedAt?: string;
  sendStatus: string;
  sentAt?: string;
  createdAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  meetingStartsAt?: string;
  meetingStatus?: string;
};

const when = (value?: string) =>
  value ? new Date(value).toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'}) : '';

/** One phrase per invitation, saying the thing the sender actually wants to know. */
function outcome(invite: SentInvite): {tone: string; label: string; detail: string} {
  if (invite.revokedAt) return {tone:'off', label:'Withdrawn', detail:`You withdrew this on ${when(invite.revokedAt)}.`};
  if (invite.decision === 'ACCEPTED')
    return {tone:'yes', label:'Accepted', detail: invite.meetingStartsAt
      ? `Booked for ${when(invite.meetingStartsAt)}.`
      : `Accepted on ${when(invite.decidedAt)}.`};
  if (invite.decision === 'DECLINED')
    return {tone:'no', label:'Declined', detail:`They declined on ${when(invite.decidedAt)}.`};
  // A send that never left is not a pending answer — nobody was ever asked.
  if (invite.sendStatus === 'FAILED')
    return {tone:'no', label:'Not delivered', detail:'The email could not be sent, so nobody was invited.'};
  if (invite.expiresAt && Date.parse(invite.expiresAt) <= Date.now())
    return {tone:'off', label:'Expired', detail:'The invitation ran out before it was answered.'};
  return {tone:'wait', label:'Waiting', detail: invite.sentAt ? `Sent ${when(invite.sentAt)}.` : 'Sending.'};
}

export default function SentInvites({workspaceId}:{workspaceId:string}) {
  const sent = useRows<SentInvite>(`workspaces/${workspaceId}/meeting-outreach`);
  if (sent.error) return <section className="sent-invites"><h2>Invitations you have sent</h2><p role="alert">These could not be loaded right now.</p></section>;
  if (!sent.rows) return <section className="sent-invites"><h2>Invitations you have sent</h2><p role="status">Loading your invitations…</p></section>;
  if (!sent.rows.length) return null;
  return <section className="sent-invites">
    <h2>Invitations you have sent</h2>
    <ul className="sent-list">
      {sent.rows.map(invite => {
        const state = outcome(invite);
        return <li key={invite.id} className={`sent-row ${state.tone}`}>
          <div className="sent-who">
            <strong>{invite.recipientName || invite.recipientEmail}</strong>
            {invite.recipientName && <small>{invite.recipientEmail}</small>}
            {invite.purpose && <small>{invite.purpose}</small>}
          </div>
          <div className="sent-state">
            <span className="sent-label">{state.label}</span>
            <small>{state.detail}</small>
          </div>
        </li>;
      })}
    </ul>
  </section>;
}
