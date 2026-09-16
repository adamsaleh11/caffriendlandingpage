'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { joinState, joinOpensText, startsInText, type UpcomingMeeting } from '@/lib/upcoming';
import Modal from '@/components/crm/Modal';

/**
 * Join, and what stands in its place when the call cannot be entered.
 *
 * The door is shut until five minutes before the start, exactly as it is on the phone,
 * and that is the whole reason: the two clients should not disagree about when a call
 * can be entered. The server has no such window — a member may join at any hour and the
 * room mints itself on first arrival — so this is a product rule the web keeps on
 * purpose, not a guard against an unprovisioned room. The button stays where it is and
 * says why: the countdown alone was not enough, because nothing stopped the press that
 * followed.
 *
 * A booking with no room is a different thing entirely. Its `groupCallId` is written in
 * the same transaction as the booking and never filled in later, so there is nothing to
 * wait for and the surface says so rather than promising a link that is coming.
 *
 * Every surface that offers Join renders this, so the three of them cannot drift into
 * disagreeing about whether a given booking can be entered.
 */
export default function JoinAction({meeting, now: given, label, className = 'up-join', inDialog}:{
  meeting: UpcomingMeeting;
  /**
   * The list already keeps one clock for every card it draws and passes it in. A lone
   * control — the meeting page — has nobody to keep one for it, so it ticks its own
   * and a card that is too early becomes joinable without a reload either way.
   */
  now?: number;
  /** The control's own content. The cards use an orange pill; a page uses a word. */
  label?: ReactNode;
  className?: string;
  /**
   * True where this already sits inside a dialog — the month calendar's call detail.
   * A dialog opened from inside a dialog traps focus in the wrong one and labels both
   * by the same heading, so the notice is shown in place instead.
   */
  inDialog?: boolean;
}) {
  const [tooEarly, setTooEarly] = useState(false);
  const [ticked, setTicked] = useState(() => Date.now());
  const owned = given === undefined;
  useEffect(() => {
    if (!owned) return;
    const timer = setInterval(() => setTicked(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [owned]);
  const now = given ?? ticked;
  const state = joinState(meeting, now);
  const content = label ?? <span className="up-join-inner"><span aria-hidden="true">▶</span>Join</span>;

  if (state === 'payment') return <span className="up-pending">Payment required</span>;
  // A place to be, not a call to open.
  if (state === 'none') return null;
  if (state === 'unavailable') return <div className="up-action-stack">
    <span className="up-pending">Call unavailable</span>
    <p className="up-early">This booking has no call room. Ask the organizer to resend the invitation.</p>
  </div>;

  // `open` and `early` both mean a room was found, so this cannot be null — but the
  // type cannot know that, and a cast would outrank the one place that decides it.
  const href = meeting.href;
  if (!href) return null;

  const early = state === 'early';
  return <div className="up-action-stack">
    {early
      ? <button type="button" className={className} onClick={() => setTooEarly(true)}>{content}</button>
      : meeting.external
        ? <a className={className} href={href} target="_blank" rel="noreferrer noopener">{content}</a>
        : <Link className={className} href={href}>{content}</Link>}
    {early && <p className="up-early">{startsInText(meeting.startsAt, now)}</p>}
    {/* Deliberately not a disabled button: the booking is real and the room simply is
        not open yet, and a dead control says neither of those things. */}
    {tooEarly && (inDialog
      ? <p className="up-early" role="status">{joinOpensText(meeting.startsAt, now)}</p>
      : <Modal title="Not open yet" description={meeting.title} onClose={() => setTooEarly(false)}>
          <p>{joinOpensText(meeting.startsAt, now)}</p>
          <div className="modal-actions"><button type="button" onClick={() => setTooEarly(false)}>Got it</button></div>
        </Modal>)}
  </div>;
}
