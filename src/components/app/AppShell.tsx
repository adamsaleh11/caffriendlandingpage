'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sections, sectionIcons, sectionNames, type Workspace } from '@/lib/contracts';
import NativeNav from './NativeNav';


/**
 * The Caffriend app shell.
 *
 * The workspace sidebar is deliberately always here, exactly as it is in the CRM:
 * the two surfaces share one sign-in, and the CRM must never be more than a click
 * away. The top-right navbar carries the app screens; the sidebar carries the CRM.
 * Events are not a sidebar destination: they are one of the Home categories.
 */
export default function AppShell({workspaces, children}:{workspaces:Workspace[]; children:ReactNode}) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const workspace = workspaces[0];

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'caffriend.signedout') { try { sessionStorage.clear(); } catch {} window.location.replace('/login'); }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return <div className="crm shell">
    <a className="skip-link" href="#app-content">Skip to content</a>
    <header className="mobile-header">
      <Link href="/home" className="brand">caffriend</Link>
      <button ref={toggle} aria-expanded={open} aria-controls="app-sidebar" onClick={() => setOpen(!open)}>Menu</button>
    </header>
    <aside id="app-sidebar" className={`sidebar ${open ? 'open' : ''}`}
      onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); } }}>
      <Link href="/home" className="brand">caffriend<span> app</span></Link>
      <p className="eyebrow nav-label">WORKSPACE</p>
      {workspace
        ? <nav aria-label="Workspace navigation">
            {sections.map(section => <Link key={section} href={`/app/${workspace.id}/${section}`}>
              <span className="nav-icon" aria-hidden="true">{sectionIcons[section]}</span>
              {sectionNames[section]}
            </Link>)}
          </nav>
        : <nav aria-label="Workspace navigation">
            {/* No workspace loaded — /app resolves or offers to create one. */}
            <Link href="/app"><span className="nav-icon" aria-hidden="true">◎</span>Your CRM</Link>
          </nav>}
      <div className="sidebar-footer">
        <button onClick={async () => {
          try { await fetch('/api/session', {method:'DELETE', headers:{'X-Caffriend-Request':'1'}}); } catch {}
          try { sessionStorage.clear(); localStorage.setItem('caffriend.signedout', String(Date.now())); } catch {}
          window.location.replace('/login');
        }}>Sign out</button>
        <p className="small">Your relationships. Your pace.</p>
      </div>
    </aside>
    <main id="app-content" tabIndex={-1} className="workspace-content"><NativeNav />{children}</main>
  </div>;
}
