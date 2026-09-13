'use client';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { applyCallEvent, callEvents, type CallState } from '@/lib/call';

/**
 * Live call updates over the backend's `/calls` namespace.
 *
 * This is the one place the browser holds a backend token. Every REST read and write goes
 * through this app's own API routes, which keep the origin and the sealed session
 * server-side — but a websocket handshake cannot be proxied that way, so the origin and a
 * token are fetched from `/api/call/realtime` and used for the handshake only. Neither is
 * put in a URL, where they would reach logs and referrers.
 */
export function useCallEvents(groupCallId: string, me: string, onEvent: (patch: (state: CallState) => CallState) => void, callSessionToken?: string | null) {
  useEffect(() => {
    let socket: Socket | undefined;
    let live = true;

    (async () => {
      // Origin and token both come from this app's own API, so no backend address has
      // to be baked into the browser bundle.
      type Realtime = {origin?: string | null; token?: string | null};
      type RealtimeWithSession = Realtime & {callSessionToken?: string | null};
      const {origin, token, callSessionToken: sessionToken}: RealtimeWithSession = await fetch('/api/call/realtime',
        {headers:{'X-Caffriend-Request':'1', ...(callSessionToken ? {'X-Caffriend-Call-Session':callSessionToken} : {})}})
        .then(response => response.ok ? response.json() as Promise<Realtime> : {} as Realtime)
        .catch((): Realtime => ({}));
      if (!live || !origin || (!token && !sessionToken)) return;
      socket = io(`${origin}/calls`, {auth:{token, callSessionToken:sessionToken}, transports:['websocket'], withCredentials:true});
      socket.on('connect', () => socket?.emit('subscribeCallRoom', {groupCallId}));
      for (const event of callEvents) {
        socket.on(event, (payload: Record<string, unknown>) =>
          onEvent(state => applyCallEvent(state, event, payload ?? {}, me)));
      }
    })();

    return () => { live = false; socket?.close(); };
  }, [groupCallId, me, onEvent, callSessionToken]);
}
