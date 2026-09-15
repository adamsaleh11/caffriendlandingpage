'use client';
import { createContext, useContext, useMemo, useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer, StartAudio, VideoTrack, useTracks, isTrackReference } from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { CallParticipant } from '@/lib/call';

type VideoFor = (person: CallParticipant) => React.ReactNode;
const MediaContext = createContext<VideoFor>(() => null);
export const useVideoFor = () => useContext(MediaContext);

/**
 * Publishes the track for one seat.
 *
 * Tracks are keyed by the LiveKit identity, which is the Caffriend user id — the same
 * id the call roster carries — so a tile and its video find each other without a
 * separate mapping. Screen share wins over camera: someone sharing wants the share seen.
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
      const match = tracks.find(track => track.participant.identity === person.userId && isTrackReference(track));
      return match && isTrackReference(match) ? <VideoTrack trackRef={match} /> : null;
    }
    return videoForSeat;
  }, [tracks]);
  return <MediaContext.Provider value={videoFor}>{children(videoFor)}</MediaContext.Provider>;
}

/**
 * The media layer is additive: the call renders from its roster whether or not LiveKit
 * connects. A refused join, a room that has not been provisioned, or a browser with no
 * camera permission costs the video, never the call.
 */
export function CallMedia({credentials, micOn, cameraOn, shareOn, children}:{
  credentials?: {token:string; url:string}; micOn: boolean; cameraOn: boolean; shareOn: boolean;
  children: (video: VideoFor) => React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  if (!credentials || failed) return <div className="call-media">{children(() => null)}</div>;

  return <div className="call-media">
    <LiveKitRoom className="call-media-room" token={credentials.token} serverUrl={credentials.url}
      connect audio={micOn} video={cameraOn} screen={shareOn} onError={() => setFailed(true)}>
      <RoomAudioRenderer />
      <StartAudio label="Enable call audio" />
      <Tracks>{children}</Tracks>
    </LiveKitRoom>
  </div>;
}
