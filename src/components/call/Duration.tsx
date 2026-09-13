'use client';
import { useEffect, useState } from 'react';

const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
};

/**
 * How long the call has been running.
 *
 * Counted from when the room was provisioned — the moment the first person joined —
 * rather than from when this browser opened the page, so everyone in the call sees the
 * same clock and someone arriving late does not see it start at zero. A call with no
 * start time (a room that was never joined) shows nothing rather than a false zero.
 */
export function Duration({startedAt, endedAt}:{startedAt:string | null; endedAt:string | null}) {
  const start = startedAt ? Date.parse(startedAt) : NaN;
  const end = endedAt ? Date.parse(endedAt) : NaN;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (Number.isNaN(start) || !Number.isNaN(end)) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [start, end]);

  if (Number.isNaN(start)) return null;
  const until = Number.isNaN(end) ? now : end;
  return <span className="call-duration">
    <span className="call-duration-dot" aria-hidden="true" />
    <span role="timer" aria-label="Call duration">{clock((until - start) / 1000)}</span>
  </span>;
}
