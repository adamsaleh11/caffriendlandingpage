'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer, StartAudio, VideoTrack, useTracks, useParticipants, useRoomContext, useConnectionState, isTrackReference } from '@livekit/components-react';
import { Track, RoomEvent, ConnectionState, type LocalTrackPublication } from 'livekit-client';
import { seatOfIdentity, type CallParticipant } from '@/lib/call';

type VideoFor = (person: CallParticipant) => React.ReactNode;
const MediaContext = createContext<VideoFor>(() => null);
export const useVideoFor = () => useContext(MediaContext);

/**
 * Publishes the track for one seat.
 *
 * Tracks are keyed by the LiveKit identity, which is composite — the account (or a
 * `guest-` stand-in) joined to the seat. The seat is the half a roster row carries, so
 * a tile and its video find each other on that rather than on the whole string, which
 * equals neither a userId nor a participantId and so matched nobody at all.
 * Screen share wins over camera: someone sharing wants the share seen.
 */
function Tracks({children}:{children:(video:VideoFor)=>React.ReactNode}) {
  const tracks = useTracks([
    {source:Track.Source.ScreenShare, withPlaceholder:false},
    {source:Track.Source.Camera, withPlaceholder:false},
  ]);
  // Named rather than an inline arrow: this returns a node for a given seat, it is
  // not itself a component, and the lint rule reads an anonymous JSX-returning arrow
  // as one.
  const videoFor = useMemo<VideoFor>(() => {
    function videoForSeat(person: CallParticipant) {
      // A placeholder is a seat with no published track yet; the tile draws its own
      // fallback for that, so only a real track is handed back.
      const mine = tracks.filter(track => isTrackReference(track) && seatOfIdentity(track.participant.identity) === person.id);
      // `useTracks` groups by participant, not by the order the sources were asked
      // for, so the share has to be picked out rather than relied on to come first —
      // otherwise a person sharing their screen still shows as their camera.
      const match = mine.find(track => track.source === Track.Source.ScreenShare) ?? mine[0];
      if (!match || !isTrackReference(match)) return null;
      // Your own camera reads as a mirror or it reads as wrong: everyone expects to
      // raise their left hand and see it on the left. A screen share is real content,
      // never flipped, and a remote camera is already the view you'd have of them.
      const mirrored = match.participant.isLocal && match.source === Track.Source.Camera;
      return <VideoTrack trackRef={match} className={mirrored ? 'is-mirrored' : undefined} />;
    }
    return videoForSeat;
  }, [tracks]);
  return <MediaContext.Provider value={videoFor}>{children(videoFor)}</MediaContext.Provider>;
}

/**
 * Reports which seats LiveKit actually has connected.
 *
 * A roster row exists from the moment someone is invited or admitted, so it says who
 * belongs in the call, never who is in it. Presence is the room's to answer, and the
 * panel sits outside the provider, so it is lifted out through a callback rather than
 * read from a context that does not reach there.
 */
function Presence({onPresence}:{onPresence:(seats:string[])=>void}) {
  const people = useParticipants();
  const seats = people.map(person => seatOfIdentity(person.identity)).filter(Boolean).sort();
  // Keyed on the joined string: the hook hands back a new array on every room event,
  // including ones that change nobody's presence.
  const key = seats.join('|');
  const report = useRef(onPresence);
  report.current = onPresence;
  useEffect(() => { report.current(key ? key.split('|') : []); }, [key]);
  return null;
}

/**
 * Keeps what is published in step with the roster row.
 *
 * `LiveKitRoom`'s own `audio`/`video`/`screen` props are join-time defaults: it applies
 * them once, on `SignalConnected`, and never again. Every toggle after that — which is
 * all of them, since you are already in the room when you press a dock button — reached
 * nothing, so sharing your screen never opened a picker at all. Publishing has to be
 * driven from the state instead.
 */
function Publish({micOn, cameraOn, shareOn, onShareEnded}:{
  micOn: boolean; cameraOn: boolean; shareOn: boolean; onShareEnded: () => void;
}) {
  const room = useRoomContext();
  // Publishing before the signal connection is up is dropped, so every effect below
  // waits for it and re-runs once it lands.
  const live = useConnectionState(room) === ConnectionState.Connected;

  useEffect(() => { if (live) void room.localParticipant.setMicrophoneEnabled(micOn).catch(() => {}); }, [room, live, micOn]);
  useEffect(() => { if (live) void room.localParticipant.setCameraEnabled(cameraOn).catch(() => {}); }, [room, live, cameraOn]);

  // The ref keeps the effect keyed on `shareOn` alone: a fresh callback each render
  // would otherwise re-run it and reopen the picker.
  const ended = useRef(onShareEnded);
  ended.current = onShareEnded;

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    void room.localParticipant.setScreenShareEnabled(shareOn).catch(() => {
      // Dismissing the browser's picker rejects here. That is a choice, not a
      // failure — the roster row goes back to not sharing and the call is untouched.
      if (!cancelled && shareOn) ended.current();
    });
    return () => { cancelled = true; };
  }, [room, live, shareOn]);

  // Chrome's own "Stop sharing" bar ends the track without going through the dock, so
  // the row has to hear about it or the button stays lit and takes two presses to
  // start a new share.
  useEffect(() => {
    const unpublished = (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) ended.current();
    };
    room.on(RoomEvent.LocalTrackUnpublished, unpublished);
    return () => { room.off(RoomEvent.LocalTrackUnpublished, unpublished); };
  }, [room]);

  return null;
}

/**
 * Nudges audio playback back to life after a remote track renegotiates.
 *
 * `StartAudio` only unlocks playback once, on the browser's autoplay block. A
 * Bluetooth device switching profiles mid-call (its owner connecting headphones, the
 * OS renegotiating HFP/A2DP) republishes their audio track without a fresh autoplay
 * block, so the listener's `<audio>` element can go silent with nothing to prompt a
 * retry. `room.startAudio()` is safe to call repeatedly — it resumes a suspended
 * AudioContext and is a no-op once playback is already flowing — so it is retried on
 * the events that mark a track coming back after such a hiccup.
 */
/**
 * Hands the live `Room` instance up to whoever asked for one.
 *
 * Leaving has to hard-disconnect this exact room before the caller is allowed to
 * navigate away or rejoin — otherwise the old signal connection can still be closing
 * when the new one opens with the same identity, and LiveKit's own "new session wins"
 * eviction can lose that race. The context only exists inside `LiveKitRoom`, so the
 * instance is lifted out through a ref rather than read where it isn't in scope.
 */
function RoomHandle({roomRef}:{roomRef: React.MutableRefObject<import('livekit-client').Room | null>}) {
  const room = useRoomContext();
  useEffect(() => {
    roomRef.current = room;
    return () => { if (roomRef.current === room) roomRef.current = null; };
  }, [room, roomRef]);
  return null;
}

function AudioResilience() {
  const room = useRoomContext();
  useEffect(() => {
    const retry = () => { void room.startAudio().catch(() => {}); };
    room.on(RoomEvent.TrackSubscribed, retry);
    room.on(RoomEvent.TrackUnmuted, retry);
    return () => {
      room.off(RoomEvent.TrackSubscribed, retry);
      room.off(RoomEvent.TrackUnmuted, retry);
    };
  }, [room]);
  return null;
}

/**
 * The media layer is additive: the call renders from its roster whether or not LiveKit
 * connects. A refused join, a room that has not been provisioned, or a browser with no
 * camera permission costs the video, never the call.
 */
export function CallMedia({credentials, micOn, cameraOn, shareOn, onShareEnded, onPresence, roomRef, children}:{
  credentials?: {token:string; url:string}; micOn: boolean; cameraOn: boolean; shareOn: boolean;
  onShareEnded: () => void;
  onPresence: (seats: string[]) => void;
  roomRef?: React.MutableRefObject<import('livekit-client').Room | null>;
  children: (video: VideoFor) => React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  // A new token means a fresh join — reset any earlier failure so this attempt gets
  // its own chance to connect, rather than staying dead for the rest of the mount
  // because a previous session (e.g. a stale identity not yet evicted) once errored.
  useEffect(() => setFailed(false), [credentials?.token]);

  if (!credentials || failed) return <div className="call-media">{children(() => null)}</div>;

  return <div className="call-media">
    <LiveKitRoom className="call-media-room" token={credentials.token} serverUrl={credentials.url}
      connect onError={(error) => { console.error('LiveKit connection failed', error); setFailed(true); }}>
      <RoomAudioRenderer />
      <StartAudio label="Enable call audio" />
      <AudioResilience />
      {roomRef && <RoomHandle roomRef={roomRef} />}
      <Presence onPresence={onPresence} />
      <Publish micOn={micOn} cameraOn={cameraOn} shareOn={shareOn} onShareEnded={onShareEnded} />
      <Tracks>{children}</Tracks>
    </LiveKitRoom>
  </div>;
}
