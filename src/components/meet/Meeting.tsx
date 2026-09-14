'use client';
import { useEffect, useState } from 'react';
import { CallScreen, type GuestCallJoin } from '@/components/call/CallScreen';
import Call from './Call';
import Preview, { type Devices } from './Preview';

type Details = {
  purpose: string; startsAt: string; endsAt: string; timezone: string;
  groupCallId: string | null; requiresDisplayName: boolean; requiresTermsAcceptance: boolean;
  platformSupported: boolean;
};

const anonymousInstallId = () => {
  const key = 'caffriend_anonymous_install_id_v1';
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
};

export default function Meeting({ inviteToken, viewerName = null }: { inviteToken: string; viewerName?: string | null }) {
  const [credentials, setCredentials] = useState<{ token: string; url: string }>();
  const [callJoin, setCallJoin] = useState<GuestCallJoin & {groupCallId:string}>();
  const [left, setLeft] = useState(false);
  const [details, setDetails] = useState<Details>();
  const [error, setError] = useState('');
  const signedInName = viewerName?.trim() || '';
  const [name, setName] = useState(signedInName);
  const [terms, setTerms] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [devices, setDevices] = useState<Devices>({ audioInput: '', videoInput: '' });
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setDetails(undefined);
    fetch('/api/meet/resolve', { method: 'POST', cache: 'no-store', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'X-Caffriend-Request': '1' }, body: JSON.stringify({ token: inviteToken }) })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; })
      .then(result => { if (!controller.signal.aborted) setDetails(result); })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof TypeError ? 'You may be offline. Check your connection and try again.' : error.message); });
    return () => controller.abort();
  }, [inviteToken, attempt]);
  async function join() {
    setJoining(true); setJoinError('');
    try {
      if (details?.groupCallId) {
        setCallJoin({
          groupCallId: details.groupCallId,
          invitationToken: inviteToken,
          displayName: name.trim(),
          acceptedTerms: terms,
          anonymousInstallId: anonymousInstallId(),
        });
        return;
      }
      const response = await fetch('/api/meet/token', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Caffriend-Request': '1' }, body: JSON.stringify({ token: inviteToken, displayName: name.trim(), acceptedTerms: terms }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCredentials(result);
    } catch (error) { setJoinError(error instanceof TypeError ? 'You may be offline. Check your connection and try again.' : (error as Error).message); }
    finally { setJoining(false); }
  }
  return <main className="meeting-page">
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load drops the LiveKit styles and call state, leaving the landing page untouched */}
    <a href="/" className="meeting-brand">caffriend</a>
    <section className="meeting-card">
      <p className="meeting-eyebrow">YOUR COFFEE CHAT</p>
      {left ? <><h1>You left the call</h1><p>Your camera and microphone are off.</p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load guarantees the call page and its media context are gone */}
      <a href="/">Back to Caffriend</a></> : callJoin ? <CallScreen groupCallId={callJoin.groupCallId}
        me={callJoin.anonymousInstallId} guestJoin={callJoin}
        onLeave={() => { setCallJoin(undefined); setLeft(true); }} />
        : credentials ? <><h1>{details?.purpose}</h1><Call {...credentials} devices={devices} leave={() => { setCredentials(undefined); setLeft(true); }} /></> : error ? <><h1>Invitation unavailable</h1><p role="alert">{error}</p><button onClick={() => setAttempt(value => value + 1)}>Try again</button></>
        : !details ? <p role="status">Loading invitation…</p>
        : !details.platformSupported ? <><h1>{details.purpose}</h1><p>This invitation opens on desktop.</p></>
        : <><h1>{details.purpose}</h1><p className="meeting-when">{new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'short', timeZone: details.timezone }).format(new Date(details.startsAt))}</p><p className="meeting-zone">{details.timezone}</p><Preview devices={devices} onDevices={setDevices} />
        {signedInName
          ? <p className="meeting-as">Joining as <strong>{signedInName}</strong></p>
          : <label>Your display name<input name="displayName" value={name} onChange={event => setName(event.target.value)} autoComplete="name" maxLength={200} required /></label>}
        <p className="meeting-fineprint">Your display name and enabled microphone or camera are shared with the other call participants. Leaving stops your media.</p>
        <label className="meeting-terms"><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} />I accept the meeting and privacy terms</label>
        {joinError && <p role="alert">{joinError}</p>}
        <button disabled={!name.trim() || !terms || joining} onClick={join}>{joining ? 'Joining…' : 'Join on web'}</button></>}
    </section>
  </main>;
}
