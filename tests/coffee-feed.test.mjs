import test from 'node:test';
import assert from 'node:assert/strict';
import { coffees, stillAhead } from '../src/lib/upcoming.ts';

/**
 * The Meetings page and Upcoming Calls are the same list: every accepted coffee, once
 * each, from the one feed that both surfaces read.
 */

const call = (over) => ({
  id: 'e1', groupCallId: 'room-1', startDate: '2026-10-01T15:00:00.000Z',
  endDate: '2026-10-01T15:30:00.000Z', counterpart: 'Sam Fox', counterpartId: 'them',
  image: null, format: 'Online', notes: null, needsPayment: false, threadId: null,
  source: 'CRM', venue: 'CAFFRIEND_LIVEKIT', physicalLocation: null, joinUrl: null,
  meetingType: null, status: null, timezone: 'UTC', purpose: 'Coffee',
  meetingId: null, workspaceId: null, engagementId: null, ...over,
});

test('a calendar-failed meeting is still shown and still joinable', () => {
  const [row] = coffees([call({status: 'FAILED', meetingId: 'm1'})]);
  assert.equal(row.href, '/calls/room-1', 'the room is the room whatever the calendar did');
  assert.equal(row.status, 'failed');
});

test('two coffees are two cards, even when they share a meeting record', () => {
  const rows = coffees([
    call({id: 'e1', groupCallId: 'room-1', meetingId: 'm1'}),
    call({id: 'e2', groupCallId: 'room-2', meetingId: 'm1', startDate: '2026-10-02T15:00:00.000Z'}),
  ]);
  assert.equal(rows.length, 2, 'the server de-duplicates; the client must not');
  assert.deepEqual(rows.map(row => row.groupCallId), ['room-1', 'room-2']);
});

test('the other person is named and the room carried through', () => {
  const [row] = coffees([call({})]);
  assert.equal(row.counterpart, 'Sam Fox');
  assert.equal(row.groupCallId, 'room-1');
  assert.equal(row.where, 'Caffriend call');
});

test('a coffee with no room offers no join link', () => {
  const [row] = coffees([call({groupCallId: null})]);
  assert.equal(row.href, null);
});

test('coffees come back earliest first, and a past one is not still ahead', () => {
  const rows = coffees([
    call({id: 'b', startDate: '2026-10-02T15:00:00.000Z'}),
    call({id: 'a', startDate: '2026-10-01T15:00:00.000Z'}),
  ]);
  assert.deepEqual(rows.map(row => row.key), ['call:a', 'call:b']);
  assert.equal(stillAhead(rows[0], Date.parse('2026-11-01T00:00:00.000Z')), false);
});
