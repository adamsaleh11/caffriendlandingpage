'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sections, sectionIcons, sectionNames, type Section, type Workspace, type User } from '@/lib/contracts';
import NativeNav from '@/components/app/NativeNav';
import { forgetAll } from '@/lib/remember';
import {FormSelect} from '@/components/ui/form-select';

export default function Shell({workspaces,workspace,section,user,children}:{workspaces:Workspace[];workspace:Workspace;section:Section;user:User;children:ReactNode}){
  const router=useRouter();const [open,setOpen]=useState(false);const [menuOpen,setMenuOpen]=useState(false);
  const toggle=useRef<HTMLButtonElement>(null);const menuButton=useRef<HTMLButtonElement>(null);
  // Other open tabs leave authenticated state as soon as they are notified of a sign-out.
  useEffect(()=>{
    const onStorage=(event:StorageEvent)=>{if(event.key==='caffriend.signedout'){try{sessionStorage.clear();}catch{}forgetAll();window.location.replace('/login');}};
    window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage);
  },[]);
  return <div className="crm shell"><a className="skip-link" href="#workspace-content">Skip to content</a>
    <header className="mobile-header"><Link href="/app" className="brand">caffriend</Link><button ref={toggle} aria-expanded={open} aria-controls="workspace-sidebar" onClick={()=>setOpen(!open)}>Menu</button></header>
    <aside id="workspace-sidebar" className={`sidebar ${open?'open':''}`} onKeyDown={event=>{if(event.key==='Escape'){setOpen(false);toggle.current?.focus();}}}>
      <Link href="/app" className="brand">caffriend<span> workspace</span></Link>
      <div className="workspace-label">Switch workspace<FormSelect aria-label="Switch workspace" value={workspace.id} onValueChange={id=>router.push(`/app/${id}/${section}`)} options={workspaces.map(item=>({value:item.id,label:item.name}))} /></div>
      <p className="eyebrow nav-label">WORKSPACE</p><nav aria-label="Workspace navigation">{sections.map(item=><Link key={item} href={`/app/${workspace.id}/${item}`} aria-current={item===section?'page':undefined}><span className="nav-icon" aria-hidden="true">{sectionIcons[item]}</span>{sectionNames[item]}</Link>)}</nav>
      <div className="sidebar-footer"><Link href="/app/workspaces/new" className="text-link">+ Create workspace</Link>
        <div className="user-menu" onKeyDown={event=>{if(event.key==='Escape'&&menuOpen){setMenuOpen(false);menuButton.current?.focus();}}}>
          <button ref={menuButton} className="secondary" aria-expanded={menuOpen} aria-controls="user-menu" onClick={()=>setMenuOpen(!menuOpen)}>{user.name}</button>
          <div id="user-menu" hidden={!menuOpen} role="group" aria-label="Account">
            {/* Local web sign-out. The backend does not revoke its login token across devices. */}
            <p className="small">Signs you out of Caffriend on this browser.</p>
            <button onClick={async()=>{
              try{await fetch('/api/session',{method:'DELETE',headers:{'X-Caffriend-Request':'1'}});}catch{}
              try{sessionStorage.clear();localStorage.setItem('caffriend.signedout',String(Date.now()));}catch{}forgetAll();
              window.location.replace('/login');
            }}>Sign out</button>
          </div>
        </div>
        <p className="small">Your relationships. Your pace.</p></div>
    </aside><main id="workspace-content" tabIndex={-1} className="workspace-content"><NativeNav/>{children}</main>
  </div>;
}
