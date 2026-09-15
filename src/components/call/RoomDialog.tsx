'use client';
import { useState } from 'react';
import { participantName, type CallParticipant, type CallRoom } from '@/lib/call';
import { Icon, Hidden } from './Icon';

const waitingCount = (count: number) =>
  count === 1 ? '1 person is waiting to join' : `${count} people are waiting to join`;

export type RoomActions = {
  onDecide: (person: CallParticipant, decision: 'admit' | 'decline') => Promise<void>;
  onRemove: (person: CallParticipant) => Promise<void>;
  onControl: (field: 'locked' | 'muteOnEntry', next: boolean) => Promise<void>;
};

export function RoomDialog({room, me, waitingRoom, participants, actions, onClose}:{
  room: CallRoom; me: string; waitingRoom: CallParticipant[]; participants: CallParticipant[];
  actions: RoomActions; onClose: () => void;
}) {
  const [problem, setProblem] = useState('');
  const guard = (work: () => Promise<void>) => async () => {
    setProblem('');
    try { await work(); }
    catch (failure) { setProblem(failure instanceof Error ? failure.message : 'That could not be done right now.'); }
  };

  return <div className="call-modal" role="dialog" aria-modal="true" aria-labelledby="call-waiting-heading">
    <div className="call-modal-head">
      <h2 id="call-waiting-heading">Waiting room</h2>
      <button className="call-modal-close" onClick={onClose} title="Close">
        <Icon name="x-lg" size={14} /><Hidden>Close</Hidden>
      </button>
    </div>
    <p>{waitingRoom.length ? waitingCount(waitingRoom.length) : 'Nobody is waiting'}</p>
    {problem && <p role="alert">{problem}</p>}

    <ul className="call-waiting" aria-label="Waiting to join">
      {waitingRoom.map(person => <li key={person.id}>
        <span className="call-waiting-name">{person.displayName}</span>
        <span className="call-waiting-detail">{[person.jobTitle, person.company].filter(Boolean).join(' at ')}</span>
        <button onClick={guard(() => actions.onDecide(person, 'admit'))}>Admit</button>
        <button className="secondary" onClick={guard(() => actions.onDecide(person, 'decline'))}>Not now</button>
      </li>)}
    </ul>

    <h3>Host controls</h3>
    <div className="call-switch">
      <span id="call-lock-label">Lock the room</span>
      <span className="call-switch-hint">No one new can join</span>
      <button role="switch" aria-checked={room.locked} aria-labelledby="call-lock-label"
        onClick={guard(() => actions.onControl('locked', !room.locked))}>
        <Icon name={room.locked ? 'toggle-on' : 'toggle-off'} size={30}
          color={room.locked ? 'var(--caf-orange)' : 'var(--caf-grey-300)'} />
        <Hidden>{room.locked ? 'On' : 'Off'}</Hidden>
      </button>
    </div>
    <div className="call-switch">
      <span id="call-mute-label">Mute everyone on entry</span>
      <span className="call-switch-hint">Guests join muted</span>
      <button role="switch" aria-checked={room.muteOnEntry} aria-labelledby="call-mute-label"
        onClick={guard(() => actions.onControl('muteOnEntry', !room.muteOnEntry))}>
        <Icon name={room.muteOnEntry ? 'toggle-on' : 'toggle-off'} size={30}
          color={room.muteOnEntry ? 'var(--caf-orange)' : 'var(--caf-grey-300)'} />
        <Hidden>{room.muteOnEntry ? 'On' : 'Off'}</Hidden>
      </button>
    </div>

    <h3>In the room</h3>
    <ul className="call-manage" aria-label="Remove a participant">
      {participants.map(person => <li key={person.id}>
        <span>{participantName(person, me)}</span>
        {/* Removing yourself is leaving, which the dock owns. */}
        {person.userId !== me && <button className="danger" onClick={guard(() => actions.onRemove(person))}>Remove</button>}
      </li>)}
    </ul>

  </div>;
}
