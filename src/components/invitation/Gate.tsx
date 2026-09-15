'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * The choice that comes before the booking: bring an account, or stay a guest.
 *
 * Signing in or creating an account here is what makes the coffee chat a
 * connection — the backend connects the two people once the invited address
 * belongs to an account, the same relationship a match in the native app is.
 * Continuing as a guest books the chat and nothing more, which is why it is
 * offered plainly rather than buried: a guest booking is a supported outcome,
 * not a failure to sign up.
 */

type Credential = {credential?: string};
type GoogleId = {
  accounts: {id: {
    initialize: (options: {client_id: string; callback: (response: Credential) => void}) => void;
    renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
  }};
};

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

export default function Gate({host, email, clientId, onGuest, onSignedIn}:{
  host: string; email?: string | null; clientId?: string;
  onGuest: () => void; onSignedIn: (created: boolean) => void;
}) {
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState<{email: string; password: string}>();
  const googleButton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clientId || !googleButton.current) return;
    let cancelled = false;

    const render = () => {
      const google = (window as unknown as {google?: GoogleId}).google;
      if (cancelled || !google || !googleButton.current) return;
      google.accounts.id.initialize({client_id: clientId, callback: async (response) => {
        if (!response.credential) { setProblem('Google did not return a sign-in. Try again.'); return; }
        setBusy(true); setProblem('');
        try {
          const result = await fetch('/api/session/google', {method:'POST', cache:'no-store',
            headers:{'Content-Type':'application/json','X-Caffriend-Request':'1'},
            body: JSON.stringify({idToken: response.credential})});
          const body = await result.json();
          if (!result.ok) throw new Error(body.error);
          onSignedIn(body.isNew === true);
        } catch (error) {
          setProblem(error instanceof Error ? error.message : 'Sign in with Google could not be completed.');
        } finally { setBusy(false); }
      }});
      // Cleared first: the effect can run again (React does so in development,
      // and the client id can change), and the button must not stack up.
      googleButton.current.replaceChildren();
      google.accounts.id.renderButton(googleButton.current, {type:'standard', theme:'outline', size:'large', text:'continue_with', width:280});
    };

    if ((window as unknown as {google?: GoogleId}).google) { render(); return () => { cancelled = true; }; }
    // Loaded here rather than in the document head: the script is only needed
    // by people who reach this screen.
    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT; script.async = true; script.defer = true;
    script.onload = render;
    script.onerror = () => { if (!cancelled) setProblem('Google sign-in could not be loaded.'); };
    document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [clientId, onSignedIn]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!password) return;
    setBusy(true); setProblem('');
    try {
      const result = await fetch('/api/session', {method:'POST', cache:'no-store',
        headers:{'Content-Type':'application/json','X-Caffriend-Request':'1'}, body: JSON.stringify(password)});
      const body = await result.json();
      if (!result.ok) throw new Error(body.error);
      onSignedIn(false);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally { setBusy(false); }
  }

  return <>
    <p className="eyebrow">Before you book</p>
    <h1>Book with {host}</h1>
    <p>Sign in or create an account and you and {host} stay connected after the chat — the same
      connection you would have in the Caffriend app. You can also book as a guest.</p>

    {clientId
      ? <div className="gate-google"><div ref={googleButton} /></div>
      : <p className="small">Google sign-in is unavailable right now — sign in with your email below, or book as a guest.</p>}

    {password
      ? <form className="gate-signin" onSubmit={signIn}>
          <label>Email or phone number
            <input type="text" autoComplete="username" value={password.email} required
              onChange={event => setPassword({...password, email: event.target.value})} />
          </label>
          <label>Password
            <input type="password" autoComplete="current-password" value={password.password} required
              onChange={event => setPassword({...password, password: event.target.value})} />
          </label>
          <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in and continue'}</button>
        </form>
      : <button type="button" className="secondary gate-option" disabled={busy}
          onClick={() => setPassword({email: email ?? '', password: ''})}>Sign in with an email and password</button>}

    {problem && <p role="alert">{problem}</p>}

    <button type="button" className="secondary gate-option" disabled={busy} onClick={onGuest}>
      Continue as a guest
    </button>
    <p className="small">As a guest your chat is still booked. You just will not be connected afterwards.</p>
  </>;
}
