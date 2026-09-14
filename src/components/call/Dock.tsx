'use client';
import { useEffect, useState } from 'react';
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

/**
 * Picture in picture, against the browser's own API.
 *
 * There is nothing to ask a server for: the stage's lead video is already playing in
 * this document, and `requestPictureInPicture` hands that same element to the browser's
 * floating window. The control is only offered where the browser offers the feature —
 * Firefox and iOS Safari do not expose it to script — rather than shown and inert.
 */
function usePictureInPicture() {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);

  useEffect(() => {
    setSupported(typeof document !== 'undefined' && document.pictureInPictureEnabled);
    const sync = () => setOn(Boolean(document.pictureInPictureElement));
    document.addEventListener('enterpictureinpicture', sync, true);
    document.addEventListener('leavepictureinpicture', sync, true);
    return () => {
      document.removeEventListener('enterpictureinpicture', sync, true);
      document.removeEventListener('leavepictureinpicture', sync, true);
    };
  }, []);

  const toggle = async () => {
    try {
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return; }
      // The lead tile's video, which is the one the stage is already leading with.
      const video = document.querySelector<HTMLVideoElement>('.call-tile[data-lead="true"] video')
        ?? document.querySelector<HTMLVideoElement>('.call-tile video');
      if (video) await video.requestPictureInPicture();
    } catch {
      // A browser that refuses (no user gesture credit, or a track that has gone) leaves
      // the call exactly as it was; there is nothing to recover.
    }
  };

  return {supported, on, toggle};
}

export function Dock({me, controls}:{me:CallParticipant | undefined; controls:SelfControls}) {
  const pip = usePictureInPicture();
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
    <Round icon="hand-index-thumb" on={me.handRaised}
      label={me.handRaised ? 'Lower hand' : 'Raise hand'}
      onClick={() => controls.onToggle('handRaised', !me.handRaised)} />
    {pip.supported && <Round icon="pip" on={pip.on}
      label={pip.on ? 'Leave picture in picture' : 'Picture in picture'}
      onClick={() => void pip.toggle()} />}
    <span className="call-dock-rule" aria-hidden="true" />
    <button className="call-leave" onClick={controls.onLeave}>
      <Icon name="telephone-x-fill" size={18} />Leave
    </button>
  </div>;
}
