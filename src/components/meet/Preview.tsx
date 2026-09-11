'use client';
import { useEffect, useRef, useState } from 'react';

export type Devices = { audioInput: string; videoInput: string };

export default function Preview({ devices, onDevices }: { devices: Devices; onDevices: (value: Devices) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [granted, setGranted] = useState(false);
  const [available, setAvailable] = useState<MediaDeviceInfo[]>([]);
  const stop = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };
  useEffect(() => () => { generation.current++; stop(); }, []);

  async function open(next: Devices) {
    const current = ++generation.current;
    setPending(true); setError(''); stop();
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: next.videoInput ? { deviceId: { exact: next.videoInput } } : true,
        audio: next.audioInput ? { deviceId: { exact: next.audioInput } } : true,
      });
      if (current !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      if (video.current) video.current.srcObject = media;
      setGranted(true);
      // Labels are only populated once permission has been granted.
      try { setAvailable(await navigator.mediaDevices.enumerateDevices()); } catch { setAvailable([]); }
    } catch {
      if (current === generation.current) setError('Camera or microphone unavailable. Allow access in your browser site settings, check the device is connected and not in use, then try again. You can also join with camera and microphone off.');
    } finally { if (current === generation.current) setPending(false); }
  }

  const choose = (kind: keyof Devices, deviceId: string) => {
    const next = { ...devices, [kind]: deviceId };
    onDevices(next);
    void open(next);
  };
  const options = (kind: MediaDeviceKind) => available.filter(device => device.kind === kind);

  return <section aria-label="Device preview">
    <video ref={video} muted autoPlay playsInline aria-label="Your camera preview" />
    <p>You will join with camera and microphone off. Turn them on inside the call when ready.</p>
    <button disabled={pending} onClick={() => open(devices)}>{pending ? 'Opening devices…' : 'Preview camera and microphone'}</button>
    {granted && <>
      <label>Microphone<select value={devices.audioInput} onChange={event => choose('audioInput', event.target.value)}>
        {options('audioinput').map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microphone'}</option>)}
      </select></label>
      <label>Camera<select value={devices.videoInput} onChange={event => choose('videoInput', event.target.value)}>
        {options('videoinput').map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Camera'}</option>)}
      </select></label>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
