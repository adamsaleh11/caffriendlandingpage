import test from 'node:test';
import assert from 'node:assert/strict';
import { projectCallState, applyCallEvent } from '../src/lib/call.ts';

/**
 * A note reaches the room over the socket, and the author is in the room too. A
 * private note is redacted on the way out so nobody else can read it — which left
 * its own author looking at a blank where their words had been, in every tab but
 * the one they typed in. The author's copy rides along beside the redacted one.
 */

const empty = () => projectCallState({room: {id: 'r1'}});
const created = (state, payload, me) => applyCallEvent(state, 'call.note.created', payload, me);

test('the author of a private note is shown their own words', () => {
  const state = created(empty(), {
    note: {id: 'n1', scope: 'private', body: null, authorUserId: 'u_123'},
    authorNote: {id: 'n1', scope: 'private', body: 'ask about the pilot', authorUserId: 'u_123'},
  }, 'u_123');
  assert.deepEqual(state.notes.map(note => note.body), ['ask about the pilot']);
});

test('a private note is withheld from everyone it does not belong to', () => {
  const state = created(empty(), {
    note: {id: 'n1', scope: 'private', body: null, authorUserId: 'u_123'},
    authorNote: {id: 'n1', scope: 'private', body: 'ask about the pilot', authorUserId: 'u_123'},
  }, 'u_999');
  assert.deepEqual(state.notes, []);
});

/**
 * The author writes the note and the socket tells them about it, so the note must
 * survive arriving twice: once was the duplicate everyone saw in their own list.
 */
test('a note the room already has is not added a second time', () => {
  const once = created(empty(), {note: {id: 'n1', scope: 'shared', body: 'great work', authorUserId: 'u_123'}}, 'u_123');
  const twice = created(once, {note: {id: 'n1', scope: 'shared', body: 'great work', authorUserId: 'u_123'}}, 'u_123');
  assert.equal(twice.notes.length, 1);
});
