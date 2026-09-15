import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedCalls } from '../src/lib/app-projection.ts';

/**
 * `/calendar/accepted-events/:type` is not workspace-scoped: it finds a coffee for
 * anyone on it, from either surface. Every row it returns belongs on the page.
 */

const feed = (...rows) => ({data: rows});
const row = (over) => ({
  id: 'e1', groupCallId: 'room-1', startDate: '2026-10-01T15:00:00.000Z',
  endDate: '2026-10-01T15:30:00.000Z', purpose: 'Coffee',
  booker: {id: 'me'}, targetUser: {id: 'them', firstName: 'Sam', lastName: 'Fox'},
  ...over,
});

test('a coffee booked from another workspace still reaches the viewer', () => {
  const calls = acceptedCalls(feed(row({workspaceId: 'workspace-b'})), 'me');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].groupCallId, 'room-1');
});

test('a coffee booked from the phone, carrying no workspace at all, still reaches the viewer', () => {
  const calls = acceptedCalls(feed(row({workspaceId: null})), 'me');
  assert.equal(calls.length, 1);
});

test('the feed is read whether it arrives wrapped in data or as a bare array', () => {
  assert.equal(acceptedCalls([row({})], 'me').length, 1);
  assert.equal(acceptedCalls(feed(row({})), 'me').length, 1);
  assert.equal(acceptedCalls({}, 'me').length, 0);
});
