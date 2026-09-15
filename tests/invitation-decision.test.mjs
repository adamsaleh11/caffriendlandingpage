import test from 'node:test';
import assert from 'node:assert/strict';
import { decideRequest } from '../src/lib/contracts.ts';

/**
 * Answering an emailed invitation. A guest may confirm without an account: `decide`
 * takes an optional bearer token and never refuses a guest, so nothing here may make
 * one a precondition of confirming.
 */

test('accepting sends the chosen time and nothing else', () => {
  const body = decideRequest({token: 't', decision: 'ACCEPTED', slotId: 'slot-1'});
  assert.deepEqual(body, {token: 't', decision: 'ACCEPTED', slotId: 'slot-1'});
});

test('desktop sends neither role nor format — the venue derives the format', () => {
  const body = decideRequest({token: 't', decision: 'ACCEPTED', slotId: 'slot-1'});
  assert.ok(!('role' in body));
  assert.ok(!('format' in body));
});

test('declining carries no slot', () => {
  assert.deepEqual(decideRequest({token: 't', decision: 'DECLINED'}), {token: 't', decision: 'DECLINED'});
});

test('accepting without a chosen time is not sendable', () => {
  assert.equal(decideRequest({token: 't', decision: 'ACCEPTED'}), null);
});
