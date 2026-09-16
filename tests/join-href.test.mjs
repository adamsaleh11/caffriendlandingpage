import test from 'node:test';
import assert from 'node:assert/strict';
import { fromMeeting, joinState } from '../src/lib/upcoming.ts';

/**
 * Where the Join button goes, per venue.
 *
 * A Caffriend call with no room behind it used to produce an address with
 * `undefined` in it, and pressing it returned a 404 that read exactly like being
 * refused entry to a call that does exist. There is nothing to press instead.
 */

const meeting = (over = {}) => ({
  id: 'm1', purpose: 'Coffee chat', status: 'CONFIRMED',
  startsAt: '2026-09-15T10:00:00.000Z', endsAt: '2026-09-15T10:30:00.000Z', ...over,
});

test('a Caffriend call with no room offers nothing to press', () => {
  const row = fromMeeting(meeting({venue: 'CAFFRIEND_LIVEKIT', groupCallId: null}));
  assert.equal(row.href, null);
});

/**
 * What the card offers, and why.
 *
 * A `groupCallId` is written in the same transaction as the booking, so a Caffriend
 * call that reaches the card without one is never going to get one — the booking
 * mirror was swallowed, or the read-side lookup missed. Calling that "pending" tells
 * someone to wait for something that will never arrive.
 */
test('a Caffriend call whose room never arrived is broken, not pending', () => {
  const row = fromMeeting(meeting({venue: 'CAFFRIEND_LIVEKIT', groupCallId: null}));
  assert.equal(joinState(row, Date.now()), 'unavailable');
});

test('a place to be offers nothing to press, and nothing is wrong with it', () => {
  const row = fromMeeting(meeting({venue: 'IN_PERSON', physicalLocation: 'Blue Bottle, Hayes Valley'}));
  assert.equal(joinState(row, Date.now()), 'none');
});

/**
 * The five-minute door is ours, not the backend's: a member may join at any hour and
 * the room mints itself on first arrival. It is kept because the phone works this way
 * and the two should agree, so it is a product rule and has to be tested like one.
 */
test('a Caffriend call with a room is early until its door opens, then open', () => {
  const start = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();
  const row = (minutes) => fromMeeting(meeting({venue: 'CAFFRIEND_LIVEKIT', groupCallId: 'g1', startsAt: start(minutes)}));
  assert.equal(joinState(row(30), Date.now()), 'early');
  assert.equal(joinState(row(4), Date.now()), 'open');
});
