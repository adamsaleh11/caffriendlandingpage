import test from 'node:test';
import assert from 'node:assert/strict';
import { project, projectTimelinePage } from '../src/lib/crm-projection.ts';

/**
 * The client boundary for the engagement timeline.
 *
 * The timeline is projected on its own rather than joining the CRM resource
 * vocabulary, which would also expose it through the generic list and get paths.
 * As everywhere else here, a field the server adds later is withheld until it is
 * named, rather than leaking the day it ships.
 */

const row = {
  id: 'a1', kind: 'MEETING_BOOKED', occurredAt: '2026-02-02T10:00:00.000Z',
  summary: 'Meeting booked', actorType: 'GUEST', actorMemberId: null, actorAgentId: null,
  // Columns the server sends that this product does not render.
  seq: '21', channel: null, body: null, reference: null, outcome: null,
  metadata: {meetingId: 'm1', startsAt: '2026-02-03T09:00:00.000Z'},
};

test('a timeline row discloses only the whitelisted fields', () => {
  const {items} = projectTimelinePage({items: [row], nextCursor: 'c1'});
  assert.deepEqual(Object.keys(items[0]).sort(), [
    'actorAgentId', 'actorMemberId', 'actorType', 'id', 'kind', 'occurredAt', 'summary',
  ]);
});

test('a timeline page carries its cursor, and a malformed body reads as empty', () => {
  assert.equal(projectTimelinePage({items: [row], nextCursor: 'c1'}).nextCursor, 'c1');
  assert.deepEqual(projectTimelinePage(null), {items: [], nextCursor: null});
});

test('an engagement discloses lastActivityAt, which the board reads for recency', () => {
  const engagement = project('engagements', {
    id: 'e1', workspaceId: 'w1', createdAt: 'c', updatedAt: 'u', pipelineId: 'p1',
    stageId: 's1', status: 'OPEN', objective: 'Partner', lastActivityAt: '2026-02-02T10:00:00.000Z',
  });
  assert.equal(engagement.lastActivityAt, '2026-02-02T10:00:00.000Z');
});
