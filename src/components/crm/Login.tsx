'use client';
import { useState } from 'react';
export default function Login({returnTo}:{returnTo:string}) {
  const [error,setError] = useState(''); const [pending,setPending] = useState(false);
  return <main className="crm login"><form className="card" onSubmit={async event=>{
    event.preventDefault(); setPending(true);setError('');
    const form = new FormData(event.currentTarget);
    try { const response = await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json','X-Caffriend-Request':'1'},body:JSON.stringify({email:form.get('email'),password:form.get('password')})});
      const result=await response.json();if(!response.ok) throw new Error(result.error); window.location.replace(returnTo);
    } catch(error){setError(error instanceof Error?error.message:'Please try again.');setPending(false);}
  }}>{/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load leaves CRM styling and providers behind, keeping the landing page untouched */}
    <a href="/" className="brand">caffriend<span> / workspace</span></a><h1>Welcome back</h1><p>Sign in to your Caffriend workspace.</p>
    <label>Email or phone number<input name="email" autoComplete="username" required maxLength={320}/></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={1024}/></label>
    {error && <p role="alert">{error}</p>}<button disabled={pending}>{pending?'Signing in…':'Sign in'}</button>
  </form></main>;
}
