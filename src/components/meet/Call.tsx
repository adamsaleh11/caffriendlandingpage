'use client';
import { LiveKitRoom, useConnectionState, useParticipants, useTracks, ParticipantTile, RoomAudioRenderer, StartAudio, TrackToggle, MediaDeviceSelect } from '@livekit/components-react';
import { setLogLevel, LogLevel, Track } from 'livekit-client';
import { useMemo, useState } from 'react';
setLogLevel(LogLevel.silent);
function Status() {
  const state = useConnectionState();
  return <p role="status">{state === 'connected' ? 'Connected' : state === 'reconnecting' || state === 'signalReconnecting' ? 'Connection interrupted. Reconnecting…' : state === 'disconnected' ? 'Disconnected' : 'Connecting…'}</p>;
}
function Controls() {
  const participants = useParticipants();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const [deviceError, setDeviceError] = useState(false);
  const failure = () => setDeviceError(true);
  return <>
    <div className="meeting-videos">{tracks.map(track => <ParticipantTile key={track.participant.identity} trackRef={track} />)}</div>
    <RoomAudioRenderer />
    <StartAudio label="Enable call audio" />
    <div className="meeting-controls">
      <TrackToggle source={Track.Source.Microphone} onDeviceError={failure} aria-label="Microphone">Microphone</TrackToggle>
      <TrackToggle source={Track.Source.Camera} onDeviceError={failure} aria-label="Camera">Camera</TrackToggle>
    </div>
    <fieldset><legend>Microphone devices</legend><MediaDeviceSelect kind="audioinput" onError={failure} /></fieldset>
    <fieldset><legend>Camera devices</legend><MediaDeviceSelect kind="videoinput" onError={failure} /></fieldset>
    {deviceError && <p role="alert">Unable to use that device. Check browser site settings and try another device.</p>}
    <h2>Participants</h2>
    <ul>{participants.map(participant => <li key={participant.identity}>{participant.name || 'Participant'}{participant.isLocal ? ' (you)' : ''}{participant.isSpeaking ? ' — speaking' : ''}</li>)}</ul>
  </>;
}
export default function Call({ token, url, devices, leave }: { token: string; url: string; devices: { audioInput: string; videoInput: string }; leave: () => void }) {
  const [failure, setFailure] = useState(false);
  // A fresh object here would rebuild the Room on every render.
  const options = useMemo(() => ({
    audioCaptureDefaults: devices.audioInput ? { deviceId: devices.audioInput } : undefined,
    videoCaptureDefaults: devices.videoInput ? { deviceId: devices.videoInput } : undefined,
  }), [devices.audioInput, devices.videoInput]);
  return <div>
    <LiveKitRoom token={token} serverUrl={url} connect={!failure} audio={false} video={false}
      options={options}
      onError={() => setFailure(true)} onDisconnected={() => setFailure(true)}>
      <Status /><Controls />
      {failure && <p role="alert">Unable to connect or the call has ended. Leave and reopen the invitation to try again.</p>}
      <button onClick={leave}>Leave</button>
    </LiveKitRoom>
  </div>;
}
