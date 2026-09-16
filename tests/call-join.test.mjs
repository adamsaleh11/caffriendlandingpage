import test from 'node:test';
import assert from 'node:assert/strict';
import { projectJoin } from '../src/lib/call.ts';

/**
 * What `POST /group-calls/:id/join` answers with. The seat's own identifier is the
 * one thing every later call needs — call-state, the websocket subscription,
 * heartbeat and leave all take it — so it is projected with the same discipline as
 * the rest of the contract rather than read off the raw body.
 */

test('a join hands back the seat the caller was given', () => {
  const join = projectJoin({token: 'jwt', url: 'wss://live', participantId: 'p_456', userId: 'u_123'});
  assert.equal(join.participantId, 'p_456');
  assert.equal(join.userId, 'u_123');
});
