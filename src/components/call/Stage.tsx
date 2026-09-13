'use client';
import { useMemo } from 'react';
import { participantName, type CallParticipant } from '@/lib/call';
import { Icon, Hidden } from './Icon';

export type Layout = 'speaker' | 'grid';

/**
 * The stage is drawn from the call roster rather than from the media tracks.
 *
 * A seat exists as soon as someone is admitted, so a person whose video has not
 * arrived — still connecting, camera off, or on a weak line — holds their place
 * instead of appearing and disappearing as tracks come and go. Video is attached
 * over the top of a tile when there is a track for that person.
 */
function Tile({person, me, lead, pinned, onPin, video}:{
  person: CallParticipant; me: string; lead?: boolean; pinned: boolean;
  onPin: (id: string | null) => void; video?: React.ReactNode;
}) {
  const name = participantName(person, me);
  return <li className="call-tile" data-lead={lead ? 'true' : undefined} data-speaking={person.activeSpeaker ? 'true' : undefined}>
    {person.cameraOn && video
      ? <div className="call-tile-video">{video}</div>
      : <div className="call-tile-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</div>}
    <div className="call-tile-chip">
      <span className="call-tile-name">{name}</span>
      {person.role === 'host' && <span className="call-tile-role">Host</span>}
      {person.activeSpeaker && <Hidden>Speaking</Hidden>}
      {!person.micOn && <><Icon name="mic-mute-fill" size={12} color="var(--caf-grey-600)" /><Hidden>Muted</Hidden></>}
      {person.screenShareOn && <><Icon name="display" size={12} color="var(--caf-grey-600)" /><Hidden>Sharing</Hidden></>}
      <span className="call-quality-dot" data-weak={person.connectionQuality === 'weak' ? 'true' : undefined} />
    </div>
    {person.handRaised && <span className="call-tile-hand">
      <Icon name="hand-index-thumb-fill" size={16} color="var(--caf-white)" /><Hidden>Hand raised</Hidden>
    </span>}
    {person.userId !== me && <button className="call-tile-pin" data-pinned={pinned ? 'true' : undefined}
      onClick={() => onPin(pinned ? null : person.id)}>
      <Icon name="pin-angle-fill" size={12} />{pinned ? 'Unpin' : 'Pin'}
    </button>}
  </li>;
}

export function Stage({participants, me, layout, pinnedId, onPin, videoFor, inviteUrl}:{
  participants: CallParticipant[]; me: string; layout: Layout;
  pinnedId: string | null; onPin: (id: string | null) => void;
  videoFor?: (person: CallParticipant) => React.ReactNode;
  inviteUrl?: string;
}) {
  const others = useMemo(() => participants.filter(row => row.userId !== me), [participants, me]);

  /**
   * Who leads: an explicit pin wins, then whoever is speaking, then the first
   * other person — so the stage never leads with your own face.
   */
  const lead = useMemo(() => {
    const pinned = participants.find(row => row.id === pinnedId);
    return pinned ?? others.find(row => row.activeSpeaker) ?? others[0] ?? participants[0];
  }, [participants, others, pinnedId]);

  const ordered = useMemo(() => layout === 'grid'
    ? participants
    : [lead, ...participants.filter(row => row.id !== lead?.id)].filter(Boolean) as CallParticipant[],
  [participants, lead, layout]);

  if (layout === 'speaker' && lead) {
    // You appear once: as the inset self-view over the lead, not again in the strip.
    const strip = ordered.filter(row => row.id !== lead.id && row.userId !== me);
    const self = participants.find(row => row.userId === me);
    return <section className="call-stage-grid" aria-label="Call stage" data-layout="speaker">
      <ul className="call-tiles">
        <Tile person={lead} me={me} lead pinned={lead.id === pinnedId} onPin={onPin} video={videoFor?.(lead)} />
        {self && self.id !== lead.id && <li className="call-selfview">
          {self.cameraOn && videoFor?.(self)
            ? <div className="call-tile-video">{videoFor(self)}</div>
            : <div className="call-tile-avatar" aria-hidden="true">{'You'.slice(0, 1)}</div>}
          <span className="call-selfview-name">You</span>
          {!self.micOn && <Hidden>Muted</Hidden>}
          {self.screenShareOn && <Hidden>Sharing</Hidden>}
          {self.handRaised && <Hidden>Hand raised</Hidden>}
        </li>}
      </ul>
      {strip.length > 0 && <ul className="call-strip">
        {strip.map(person => <Tile key={person.id} person={person} me={me}
          pinned={person.id === pinnedId} onPin={onPin} video={videoFor?.(person)} />)}
      </ul>}
    </section>;
  }

  return <section className="call-stage-grid" aria-label="Call stage" data-layout={layout}>
    <ul className="call-tiles">
      {ordered.map(person => <Tile key={person.id} person={person} me={me}
        pinned={person.id === pinnedId} onPin={onPin} video={videoFor?.(person)} />)}
      {/* The kit gives the grid's spare cell to the invitation, so a half-empty room
          reads as room for more people rather than as something missing. */}
      {inviteUrl && <li className="call-tile call-invite-tile">
        <Icon name="person-plus" size={22} color="var(--caf-orange)" />
        <span className="call-invite-tile-title">Invite someone</span>
        <span className="call-invite-tile-url">{inviteUrl.replace(/^https?:\/\//, '')}</span>
      </li>}
    </ul>
  </section>;
}
