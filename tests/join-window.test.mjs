import test from 'node:test';
import assert from 'node:assert/strict';
import { canJoinAt, joinOpensText, JOIN_WINDOW_MINUTES } from '../src/lib/upcoming.ts';

/**
 * A room opens five minutes before its start, the same window the phone uses. Before
 * that the call is shown and the button is there, but pressing it explains the window
 * rather than walking someone into a room that has not been provisioned.
 */

const at = (minutesFromNow) => new Date(Date.now() + minutesFromNow * 60000).toISOString();
const now = () => Date.now();

test('the door opens exactly five minutes before the start', () => {
  assert.equal(JOIN_WINDOW_MINUTES, 5);
  assert.equal(canJoinAt(at(4), now()), true);
  assert.equal(canJoinAt(at(6), now()), false);
});

test('a call already under way is joinable', () => {
  assert.equal(canJoinAt(at(-10), now()), true);
});

test('the notice names the clock time the room opens, not just a countdown', () => {
  const start = at(60 * 24);
  const text = joinOpensText(start, now());
  const opens = new Date(Date.parse(start) - JOIN_WINDOW_MINUTES * 60000);
  assert.match(text, /5 minutes before/);
  assert.ok(text.includes(opens.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'})),
    'someone waiting needs the time to come back, not only how long is left');
});

test('a call with no start has nothing to promise', () => {
  assert.equal(canJoinAt(null, now()), false);
  assert.match(joinOpensText(null, now()), /not scheduled/i);
});
