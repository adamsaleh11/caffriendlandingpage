import test from 'node:test';
import assert from 'node:assert/strict';
import { callCounterpart } from '../src/lib/call.ts';

/**
 * Who a finished coffee chat was with, read from the room's own roster.
 *
 * An instant coffee has no booking behind it, so the roster is the only thing that can
 * name the other person — and it is not clean: the same human can appear twice, once
 * identified and once as a ghost with no `userId` and only a first name.
 */

const person = (userId, displayName, role = 'participant') => ({
  id: '', userId, displayName, role, image: null,
  micOn: true, cameraOn: true, handRaised: false, screenShareOn: false,
  connectionQuality: 'unknown', activeSpeaker: false, pinned: false,
  waitingStatus: 'admitted', leftAt: null,
});

const ME = 'me-1';

test('a plain one-to-one names the other person', () => {
  const other = callCounterpart([person(ME, 'Adam Saleh', 'host'), person('u2', 'Shil Patel')], ME);
  assert.equal(other?.displayName, 'Shil Patel');
});

test('a ghost of the counterpart does not make it a group call', () => {
  const roster = [person(ME, 'Adam Saleh', 'host'), person('u2', 'Shil Patel'), person('', 'Shil')];
  assert.equal(callCounterpart(roster, ME)?.displayName, 'Shil Patel');
});

// The ghost carries no `userId`, so it can never be recognised as the viewer and would
// otherwise be counted as a second other person.
test('a ghost of the viewer is not mistaken for somebody else', () => {
  const roster = [person('u2', 'Shil Patel', 'host'), person(ME, 'Adam Saleh'), person('', 'Adam')];
  assert.equal(callCounterpart(roster, ME)?.displayName, 'Shil Patel');
});

test('the same person listed twice is still one person', () => {
  const roster = [person(ME, 'Adam Saleh', 'host'), person('u2', 'Shil Patel'), person('u2', 'Shil Patel')];
  assert.equal(callCounterpart(roster, ME)?.displayName, 'Shil Patel');
});

test('a real group call has no single counterpart', () => {
  const roster = [person(ME, 'Adam Saleh', 'host'), person('u2', 'Shil Patel'), person('u3', 'Karan Parikh')];
  assert.equal(callCounterpart(roster, ME), null);
});

test('a call nobody else joined has no counterpart', () => {
  assert.equal(callCounterpart([person(ME, 'Adam Saleh', 'host')], ME), null);
});

// Until `/me` answers the viewer is unknown, and every name on the roster looks like
// somebody else's. Naming the call from that would show the viewer their own name.
test('an unidentified viewer names nobody rather than guessing', () => {
  const roster = [person(ME, 'Adam Saleh', 'host'), person('u2', 'Shil Patel')];
  assert.equal(callCounterpart(roster, ''), null);
});
