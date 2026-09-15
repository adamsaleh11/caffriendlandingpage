'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Sign in, or create an account, before entering the workspace.
 *
 * The three ways in are the three the backend actually supports: Google
 * (`/user/social/google`, which signs in or creates in one step), an email and
 * password (`/user/login`), and a new account (`/user/signup`, which returns a
 * token straight away — the phone number it requires is collected here for
 * that reason, not as an extra step).
 */

type Credential = {credential?: string};
type GoogleId = {
  accounts: {id: {
    initialize: (options: {client_id: string; callback: (response: Credential) => void}) => void;
    renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
  }};
};
const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

export default function Login({returnTo, googleClientId}:{returnTo:string; googleClientId?:string}) {
  const [mode,setMode] = useState<'signin'|'signup'>('signin');
  const [error,setError] = useState('');
  const [pending,setPending] = useState(false);
  const googleButton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!googleClientId || !googleButton.current) return;
    let cancelled = false;
    const render = () => {
      const google = (window as unknown as {google?: GoogleId}).google;
      if (cancelled || !google || !googleButton.current) return;
      google.accounts.id.initialize({client_id: googleClientId, callback: async response => {
        if (!response.credential) { setError('Google did not return a sign-in. Try again.'); return; }
        setPending(true); setError('');
        try {
          const result = await fetch('/api/session/google',{method:'POST',cache:'no-store',
            headers:{'Content-Type':'application/json','X-Caffriend-Request':'1'},
            body: JSON.stringify({idToken: response.credential})});
          const body = await result.json();
          if (!result.ok) throw new Error(body.error);
          window.location.replace(returnTo);
        } catch (problem) {
          setError(problem instanceof Error ? problem.message : 'Sign in with Google could not be completed.');
          setPending(false);
        }
      }});
      // Cleared first: the effect runs again in development, and the button must not stack up.
      googleButton.current.replaceChildren();
      google.accounts.id.renderButton(googleButton.current,{type:'standard',theme:'outline',size:'large',text:'continue_with',width:280});
    };
    if ((window as unknown as {google?: GoogleId}).google) { render(); return () => { cancelled = true; }; }
    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT; script.async = true; script.defer = true;
    script.onload = render;
    script.onerror = () => { if (!cancelled) setError('Google sign-in could not be loaded.'); };
    document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [googleClientId, returnTo]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError('');
    const form = new FormData(event.currentTarget);
    const value = (name:string) => String(form.get(name) ?? '');
    const path = mode === 'signin' ? '/api/session' : '/api/session/signup';
    const body = mode === 'signin'
      ? {email: value('email'), password: value('password')}
      : {firstName: value('firstName'), lastName: value('lastName'), email: value('email'),
         password: value('password'), countryCode: value('countryCode'), phoneNumber: value('phoneNumber')};
    try {
      const response = await fetch(path,{method:'POST',cache:'no-store',
        headers:{'Content-Type':'application/json','X-Caffriend-Request':'1'},body:JSON.stringify(body)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.replace(returnTo);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Please try again.');
      setPending(false);
    }
  }

  const signup = mode === 'signup';
  return <main className="crm login"><form className="card" onSubmit={submit}>
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load leaves CRM styling and providers behind, keeping the landing page untouched */}
    <a href="/" className="brand">caffriend<span> / workspace</span></a>
    <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
    <p>{signup ? 'Set up a Caffriend account to use the workspace.' : 'Sign in to your Caffriend workspace.'}</p>

    {googleClientId
      ? <div className="login-google"><div ref={googleButton} /></div>
      : <p className="login-note">Google sign-in is unavailable right now — use an email and password below.</p>}
    <p className="login-divider"><span>or</span></p>

    {signup && <div className="login-row">
      <label>First name<input name="firstName" autoComplete="given-name" required maxLength={80}/></label>
      <label>Last name<input name="lastName" autoComplete="family-name" required maxLength={80}/></label>
    </div>}
    <label>{signup ? 'Email' : 'Email or phone number'}
      <input name="email" type={signup ? 'email' : 'text'} autoComplete={signup ? 'email' : 'username'} required maxLength={320}/>
    </label>
    {signup && <div className="login-row">
      <label className="login-code">Country code<input name="countryCode" defaultValue="+1" required maxLength={5} pattern="\+[0-9]{1,4}" autoComplete="tel-country-code"/></label>
      <label>Phone number<input name="phoneNumber" type="tel" autoComplete="tel-national" required maxLength={20}/></label>
    </div>}
    <label>Password
      <input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required
        minLength={signup ? 8 : undefined} maxLength={1024}/>
    </label>
    {signup && <p className="login-note">At least 8 characters.</p>}
    {error && <p role="alert">{error}</p>}
    <button disabled={pending}>{pending ? (signup ? 'Creating account…' : 'Signing in…') : (signup ? 'Create account' : 'Sign in')}</button>
    <p className="login-switch">
      {signup ? 'Already have an account?' : 'New to Caffriend?'}{' '}
      <button type="button" className="linklike" disabled={pending}
        onClick={() => { setMode(signup ? 'signin' : 'signup'); setError(''); }}>
        {signup ? 'Sign in' : 'Sign up'}
      </button>
    </p>
  </form></main>;
}
