'use client';
import type { CallParticipant } from '@/lib/call';
import { Icon, Hidden } from './Icon';

export type SelfControls = {
  onToggle: (field: 'micOn' | 'cameraOn' | 'handRaised' | 'screenShareOn', next: boolean) => Promise<void>;
  onLeave: () => void;
};

/**
 * Each control is named for what pressing it will do, not for what is currently true, so a screen
 * reader announces the action rather than the state. The kit's control size is 56.906px — the
 * in-call button size measured in Caffriend.fig — and an engaged control fills espresso.
 */
function Round({icon, label, on, onClick}:{icon:string; label:string; on?:boolean; onClick:()=>void}) {
  return <button className="call-dock-button" data-on={on ? 'true' : undefined} onClick={onClick} title={label}>
    <Icon name={icon} size={22} />
    <Hidden>{label}</Hidden>
  </button>;
}

export function Dock({me, controls}:{me:CallParticipant | undefined; controls:SelfControls}) {
  if (!me) return null;
  return <div className="call-dock" role="group" aria-label="Call controls">
    <Round icon={me.micOn ? 'mic-fill' : 'mic-mute-fill'} on={!me.micOn}
      label={me.micOn ? 'Mute microphone' : 'Unmute microphone'}
      onClick={() => controls.onToggle('micOn', !me.micOn)} />
    <Round icon={me.cameraOn ? 'camera-video-fill' : 'camera-video-off-fill'} on={!me.cameraOn}
      label={me.cameraOn ? 'Turn camera off' : 'Turn camera on'}
      onClick={() => controls.onToggle('cameraOn', !me.cameraOn)} />
    <Round icon="display" on={me.screenShareOn}
      label={me.screenShareOn ? 'Stop sharing your screen' : 'Share your screen'}
      onClick={() => controls.onToggle('screenShareOn', !me.screenShareOn)} />
    <Round icon="emoji-smile" label="Reactions" onClick={() => undefined} />
    <Round icon="hand-index-thumb" on={me.handRaised}
      label={me.handRaised ? 'Lower hand' : 'Raise hand'}
      onClick={() => controls.onToggle('handRaised', !me.handRaised)} />
    <Round icon="pip" label="Picture in picture" onClick={() => undefined} />
    <span className="call-dock-rule" aria-hidden="true" />
    <button className="call-leave" onClick={controls.onLeave}>
      <Icon name="telephone-x-fill" size={18} />Leave
    </button>
  </div>;
}
