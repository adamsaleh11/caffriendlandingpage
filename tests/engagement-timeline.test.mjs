import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeTimeline } from '../src/lib/engagement-timeline.ts';

/**
 * Who answered a coffee-chat invitation, on the person's timeline.
 *
 * The acceptance is read from the engagement timeline endpoint's own rows. An
 * Account invitee reads as their own name; a Guest invitee as their name with a
 * `(guest)` qualifier, because only the first means a Connection now exists.
 */

const person = {id: 'p1', displayName: 'Dana Okafor'};
const acceptance = (over = {}) => ({
  id: 'a1', kind: 'MEETING_BOOKED', occurredAt: '2026-02-02T10:00:00.000Z', summary: 'Meeting booked',
  actorType: 'HUMAN', actorMemberId: null, actorAgentId: null, engagementId: 'e1', ...over,
});

test('an Account invitee acceptance is named from the person record, with no qualifier', () => {
  const [entry, ...rest] = mergeTimeline({entries: [], items: [acceptance()], person});
  assert.equal(rest.length, 0);
  assert.equal(entry.actor, 'Dana Okafor');
  assert.equal(entry.title, 'Meeting booked');
  assert.equal(entry.at, '2026-02-02T10:00:00.000Z');
});

test('a Guest invitee acceptance is named from the person record, qualified as a guest', () => {
  const [entry] = mergeTimeline({entries: [], items: [acceptance({actorType: 'GUEST'})], person});
  assert.equal(entry.actor, 'Dana Okafor (guest)');
});

test('an acceptance is never attributed to a workspace member, even when the row carries a member id', () => {
  const [entry] = mergeTimeline({entries: [], items: [acceptance({actorMemberId: 'm1'})], person});
  assert.equal(entry.actor, 'Dana Okafor');
});

test('a missing person record falls back to the generic actor word, never "Unknown"', () => {
  const [entry] = mergeTimeline({entries: [], items: [acceptance()], person: undefined});
  assert.equal(entry.actor, 'Person');
  const [guest] = mergeTimeline({entries: [], items: [acceptance({actorType: 'GUEST'})], person: undefined});
  assert.equal(guest.actor, 'Guest');
});

test('an agent-attributed row still reads as the agent', () => {
  const [entry] = mergeTimeline({
    entries: [],
    items: [acceptance({kind: 'OUTREACH_SENT', actorType: 'AGENT', actorAgentId: 'ag1', summary: 'Outreach sent'})],
    person,
    agents: [{id: 'ag1', name: 'Scout'}],
  });
  assert.equal(entry.actor, 'Scout');
  assert.equal(entry.byAgent, true);
});

test('a decline carries no account or guest qualifier, and is not named from the person record', () => {
  const [entry] = mergeTimeline({
    entries: [],
    items: [acceptance({id: 'd1', kind: 'INVITATION_DECLINED', actorType: 'GUEST', summary: 'Invitation declined'})],
    person,
  });
  assert.equal(entry.actor, 'Guest');
  assert.equal(entry.title, 'Invitation declined');
});

test('the send-time note and the acceptance row both survive, in time order', () => {
  const note = {
    id: 'note:n1', at: '2026-02-01T09:00:00.000Z', title: 'Note',
    detail: 'Invitation sent', actor: 'Note', byAgent: false, kind: 'note',
  };
  const merged = mergeTimeline({entries: [note], items: [acceptance()], person});
  assert.deepEqual(merged.map(entry => entry.id), ['note:n1', 'timeline:a1']);
});

test('an earlier acceptance sorts before a later existing entry', () => {
  const later = {
    id: 'note:n2', at: '2026-03-01T09:00:00.000Z', title: 'Note',
    actor: 'Note', byAgent: false, kind: 'note',
  };
  const merged = mergeTimeline({entries: [later], items: [acceptance()], person});
  assert.deepEqual(merged.map(entry => entry.id), ['timeline:a1', 'note:n2']);
});

/**
 * A person's page loads the timeline for every engagement it knows about, but a
 * row may name an engagement that is no longer theirs. Scoping is the module's
 * job, not the page's, so the unit runner can hold it.
 */
test('a row belonging to another engagement is left off the person timeline', () => {
  const merged = mergeTimeline({
    entries: [],
    items: [acceptance(), acceptance({id: 'a2', engagementId: 'e9'})],
    engagementIds: new Set(['e1']),
    person,
  });
  assert.deepEqual(merged.map(entry => entry.id), ['timeline:a1']);
});

test('a row naming no engagement is kept, having nothing to scope it out by', () => {
  const merged = mergeTimeline({
    entries: [],
    items: [acceptance({id: 'a3', engagementId: null})],
    engagementIds: new Set(['e1']),
    person,
  });
  assert.deepEqual(merged.map(entry => entry.id), ['timeline:a3']);
});

test('every row is kept when the caller scopes to nothing', () => {
  const merged = mergeTimeline({entries: [], items: [acceptance(), acceptance({id: 'a2', engagementId: 'e9'})], person});
  assert.equal(merged.length, 2);
});

/**
 * Sending an invitation writes `INVITATION_SENT` and then a `STAGE_CHANGED`.
 * Kinds the client has never heard of keep arriving, so a row is carried by the
 * server's own summary rather than by a kind this module recognises.
 */
test('an invitation-sent row renders on the server\'s wording, not a client label', () => {
  const [entry] = mergeTimeline({
    entries: [],
    items: [acceptance({id: 's1', kind: 'INVITATION_SENT', summary: 'Invitation sent'})],
    person,
  });
  assert.equal(entry.title, 'Invitation sent');
  assert.equal(entry.actor, 'Person');
});

test('a stage change to Scheduling survives the merge alongside the send', () => {
  const merged = mergeTimeline({
    entries: [],
    items: [
      acceptance({id: 's1', kind: 'INVITATION_SENT', summary: 'Invitation sent', occurredAt: '2026-02-01T10:00:00.000Z'}),
      acceptance({id: 's2', kind: 'STAGE_CHANGED', summary: 'Moved to Scheduling', occurredAt: '2026-02-01T10:00:01.000Z'}),
    ],
    person,
  });
  assert.deepEqual(merged.map(entry => entry.title), ['Invitation sent', 'Moved to Scheduling']);
});

test('a kind no client release has seen is still rendered, never dropped', () => {
  const merged = mergeTimeline({entries: [], items: [acceptance({id: 'x1', kind: 'SOMETHING_NEW', summary: 'Something happened'})], person});
  assert.deepEqual(merged.map(entry => entry.title), ['Something happened']);
});
