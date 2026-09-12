'use client';
import { LiveKitRoom, useConnectionState, useParticipants, useTracks, ParticipantTile, RoomAudioRenderer, StartAudio, TrackToggle, MediaDeviceSelect } from '@livekit/components-react';
import { setLogLevel, LogLevel, RemoteParticipant, Track } from 'livekit-client';
import { useEffect, useMemo, useState } from 'react';
import type { RosterMember, SpotlightState } from '@/lib/events';
import { videoPageSize } from '@/lib/events';
import { eventsApi, problemMessage } from '@/components/events/client';
setLogLevel(LogLevel.silent);
function Status() {
  const state = useConnectionState();
  return <p role="status">{state === 'connected' ? 'Connected' : state === 'reconnecting' || state === 'signalReconnecting' ? 'Connection interrupted. Reconnecting…' : state === 'disconnected' ? 'Disconnected' : 'Connecting…'}</p>;
}
function DeviceControls() {
  const connection = useConnectionState();
  const [deviceError, setDeviceError] = useState(false);
  const failure = () => setDeviceError(true);
  return <><RoomAudioRenderer /><StartAudio label="Enable call audio" /><div className="meeting-controls"><TrackToggle source={Track.Source.Microphone} onDeviceError={failure} aria-label="Microphone">Microphone</TrackToggle><TrackToggle source={Track.Source.Camera} onDeviceError={failure} aria-label="Camera">Camera</TrackToggle></div><div className="device-controls"><fieldset><legend>Microphone devices</legend><MediaDeviceSelect kind="audioinput" onError={failure} /></fieldset><fieldset><legend>Camera devices</legend><MediaDeviceSelect kind="videoinput" onError={failure} /></fieldset></div>{deviceError && connection !== 'disconnected' && <p role="alert">Unable to use that device. Check browser site settings and try another device.</p>}</>;
}
function Controls() {
  const participants = useParticipants();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  return <>
    <div className="meeting-videos">{tracks.map(track => <ParticipantTile key={track.participant.identity} trackRef={track} />)}</div>
    <DeviceControls />
    <h2>Participants</h2>
    <ul>{participants.map(participant => <li key={participant.identity}>{participant.name || 'Participant'}{participant.isLocal ? ' (you)' : ''}{participant.isSpeaking ? ' — speaking' : ''}</li>)}</ul>
  </>;
}

type EventMode={id:string;isHost:boolean};
function Spotlight({eventId,roster,onHolder}:{eventId:string;roster:RosterMember[];onHolder:(id:string|null)=>void}){
  const [state,setState]=useState<SpotlightState>();
  useEffect(()=>{let live=true;let timeout:ReturnType<typeof setTimeout>;const read=()=>eventsApi<SpotlightState>(`${eventId}/spotlight`).then(value=>{if(live){setState(value);onHolder(value.holderId);timeout=setTimeout(read,1000);}}).catch(()=>{if(live)timeout=setTimeout(read,3000);});read();return()=>{live=false;clearTimeout(timeout);};},[eventId,onHolder]);
  if(!state||state.finished)return null;const person=roster.find(member=>member.participantId===state.holderId);
  return <section className="spotlight" aria-live="polite"><div><p className="meeting-eyebrow">IN THE SPOTLIGHT</p><h2>{person?.displayName||'Next guest'}</h2></div><strong aria-label={`${Math.ceil(state.remainingMs/1000)} seconds remaining`}>{Math.ceil(state.remainingMs/1000)}s</strong>{state.reconnecting&&<span>Reconnecting…</span>}</section>;
}
function ProfileTile({track,member,connecting,onConnect}:{track:ReturnType<typeof useTracks>[number];member?:RosterMember;connecting:boolean;onConnect:(member:RosterMember)=>void}){
  return <article className="profile-tile"><ParticipantTile trackRef={track}/><footer><div><h3>{member?.displayName||'Caffriend member'}</h3>{member?.reasons?.length?<p>{member.reasons.slice(0,2).join(' · ')}</p>:<p>Live in this Caffriend room</p>}</div>{member?.canConnect&&member.userId&&<button className="connect-button" disabled={connecting} onClick={()=>onConnect(member)}>{connecting?'Saving…':'Connect'}</button>}</footer></article>;
}
function EventControls({event}:{event:EventMode}){
  const participants=useParticipants(); const tracks=useTracks([{source:Track.Source.Camera,withPlaceholder:true}]);
  const [roster,setRoster]=useState<RosterMember[]>([]); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [page,setPage]=useState(0); const [spotlight,setSpotlight]=useState<string|null>(null); const [busy,setBusy]=useState(''); const [starting,setStarting]=useState(false);
  useEffect(()=>{let live=true;const load=()=>eventsApi<RosterMember[]>(`${event.id}/roster`).then(value=>{if(live)setRoster(value);}).catch(problem=>{if(live)setError(problemMessage(problem));});load();const timer=setInterval(load,10000);return()=>{live=false;clearInterval(timer);};},[event.id]);
  const ordered=useMemo(()=>{const rank=new Map(roster.map((member,index)=>[member.userId,index]));return [...tracks].sort((a,b)=>(rank.get(a.participant.identity)??Number.MAX_SAFE_INTEGER)-(rank.get(b.participant.identity)??Number.MAX_SAFE_INTEGER));},[roster,tracks]);
  const pages=Math.max(1,Math.ceil(ordered.length/videoPageSize)); const visible=useMemo(()=>ordered.slice(page*videoPageSize,(page+1)*videoPageSize),[ordered,page]); const spotlightMember=roster.find(member=>member.participantId===spotlight); const wanted=useMemo(()=>new Set([...visible.map(ref=>ref.participant.identity),spotlightMember?.userId].filter((id):id is string=>Boolean(id))),[visible,spotlightMember?.userId]);
  useEffect(()=>{for(const participant of participants){if(!(participant instanceof RemoteParticipant))continue;for(const publication of participant.audioTrackPublications.values())void publication.setSubscribed(true);for(const publication of participant.videoTrackPublications.values())void publication.setSubscribed(wanted.has(participant.identity));}},[participants,wanted]);
  useEffect(()=>{if(page>=pages)setPage(Math.max(0,pages-1));},[page,pages]);
  async function connect(member:RosterMember){setBusy(member.userId||'');setError('');setNotice('');try{const result=await eventsApi<{mutual?:boolean}>(`${event.id}/connect`,{method:'POST',body:JSON.stringify({toUserId:member.userId})});setNotice(result.mutual?`You and ${member.displayName} connected.`:`Your interest in ${member.displayName} is private unless they connect too.`);}catch(problem){setError(problemMessage(problem));}finally{setBusy('');}}
  async function start(){setStarting(true);setError('');try{await eventsApi(`${event.id}/spotlight/start`,{method:'POST',body:JSON.stringify({turnMs:60000})});setNotice('The spotlight queue is running.');}catch(problem){setError(problemMessage(problem));}finally{setStarting(false);}}
  return <><Spotlight eventId={event.id} roster={roster} onHolder={setSpotlight}/>{event.isHost&&<div className="host-controls"><span>Host controls</span><button disabled={starting} onClick={start}>{starting?'Starting…':'Start spotlight queue'}</button></div>}{notice&&<p className="call-notice" role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}<div className="profile-grid">{visible.map(track=><ProfileTile key={track.participant.identity} track={track} member={roster.find(row=>row.userId===track.participant.identity)} connecting={busy===track.participant.identity} onConnect={connect}/>)}</div>{pages>1&&<nav className="grid-pagination" aria-label="Participant pages"><button disabled={page===0} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page+1} of {pages}</span><button disabled={page===pages-1} onClick={()=>setPage(value=>value+1)}>Next</button></nav>}<DeviceControls /><h2>Participants</h2><p>{participants.length} in the room · ordered for you</p></>;
}
export default function Call({ token, url, devices, leave, event }: { token: string; url: string; devices: { audioInput: string; videoInput: string }; leave: () => void; event?:EventMode }) {
  const [failure, setFailure] = useState(false);
  // A fresh object here would rebuild the Room on every render.
  const options = useMemo(() => ({
    audioCaptureDefaults: devices.audioInput ? { deviceId: devices.audioInput } : undefined,
    videoCaptureDefaults: devices.videoInput ? { deviceId: devices.videoInput } : undefined,
    autoSubscribe: event ? false : true,
  }), [devices.audioInput, devices.videoInput,event]);
  return <div>
    <LiveKitRoom token={token} serverUrl={url} connect={!failure} audio={false} video={false}
      options={options}
      onError={() => setFailure(true)} onDisconnected={() => setFailure(true)}>
      <Status />{event?<EventControls event={event}/>:<Controls />}
      {failure && <p role="alert">Unable to connect or the call has ended. Leave and reopen the invitation to try again.</p>}
      <button onClick={leave}>Leave</button>
    </LiveKitRoom>
  </div>;
}
