'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A focused overlay for one job at a time.
 *
 * The page behind it keeps its scroll position and its reading order: the dialog
 * is labelled by its own heading, Escape and the backdrop both close it, and
 * focus is moved in on open and returned to the control that opened it on close.
 */
export default function Modal({title, description, onClose, children, wide}:{
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    opener.current = document.activeElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // The page behind a modal is not a place to be: it is neither reachable nor
    // announced while the dialog is open.
    // Two shells can host a modal: the CRM workspace (Shell.tsx) and the app
    // (AppShell.tsx). Whichever is mounted, its main and sidebar go inert.
    const behind = ['workspace-content', 'workspace-sidebar', 'app-content', 'app-sidebar']
      .map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    for (const element of behind) { element.inert = true; element.setAttribute('aria-hidden', 'true'); }
    panel.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();

    // A popover or select opened from inside the dialog owns Escape first; this
    // listener runs in the capture phase, so it has to stand aside deliberately.
    const layerOpen = () => !!document.querySelector('[data-slot="popover-content"],[data-slot="select-content"]');

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { if (layerOpen()) return; event.stopPropagation(); onClose(); return; }
      if (event.key !== 'Tab' || !panel.current) return;
      // Tabbing stays inside the dialog: nothing behind it is reachable while it is open.
      const focusable = [...panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')];
      if (focusable.length === 0) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = previous;
      for (const element of behind) { element.inert = false; element.removeAttribute('aria-hidden'); }
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(<div className="crm modal-root modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={`modal ${wide ? 'wide' : ''}`} ref={panel} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-head">
        <div>
          <h2 id="modal-title">{title}</h2>
          {description && <p className="small">{description}</p>}
        </div>
        <button type="button" className="icon" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="modal-body">{children}</div>
    </div>
  </div>, document.body);
}
