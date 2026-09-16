import test from 'node:test';
import assert from 'node:assert/strict';
import { projectCallState, callSelf } from '../src/lib/call.ts';

/**
 * Every admitted participant needs an identity a list can be keyed by.
 *
 * Email-invited and externally-imported people arrive on the roster without the
 * backend `id` a Caffriend-booked participant carries. They are still real people
 * on the call, so they are kept — but two of them keyed by the same absent id
 * render as one row, and React drops the duplicate rather than showing the person.
 */

const row = (over = {}) => ({
  userId: 'u1', displayName: 'Dana Okafor', role: 'participant',
  waitingStatus: 'admitted', leftAt: null, ...over,
});

const state = (participants) => projectCallState({room: {id: 'r1'}, participants});

test('a participant arriving without an id is still identified, never by an empty string', () => {
  const [person] = state([row()]).participants;
  assert.notEqual(person.id, '');
  assert.equal(person.userId, 'u1');
});

test('two id-less participants keep distinct identities, so neither is dropped from a list', () => {
  const people = state([row(), row({userId: 'u2', displayName: 'Sam Chen'})]).participants;
  assert.equal(people.length, 2);
  assert.equal(new Set(people.map(person => person.id)).size, 2);
});

test("a participant's own id is preferred when the backend sends one", () => {
  const [person] = state([row({id: 'p1'})]).participants;
  assert.equal(person.id, 'p1');
});

/**
 * The backend names a seat `participantId` on the wire. Reading `id` matched
 * undefined on every row, which is why nobody could find their own seat and the
 * dock — mute, camera, leave — never rendered for anyone.
 */
test('a seat is identified by the participantId the call-state names it with', () => {
  const [person] = state([row({participantId: 'p_456'})]).participants;
  assert.equal(person.id, 'p_456');
});

/**
 * Which seat is mine. The dock renders only for someone who can find their own row,
 * and the old pair of guesses — match my userId, or match a participantId against a
 * field called `id` — found nobody on an email-link join. There is one rule now.
 */
test('the viewer finds their own seat by the participantId their join returned', () => {
  const {participants} = state([
    row({participantId: 'p_1', userId: 'u1'}),
    row({participantId: 'p_2', userId: 'u2', displayName: 'Sam Chen'}),
  ]);
  assert.equal(callSelf(participants, 'p_2')?.displayName, 'Sam Chen');
});
