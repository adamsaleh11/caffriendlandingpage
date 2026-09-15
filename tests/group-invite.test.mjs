import test from 'node:test';
import assert from 'node:assert/strict';
import { inviteRecipients } from '../src/lib/events.ts';

/**
 * Inviting people to a group call: connections and outside addresses together, in one
 * send. A connection is named by user id and gets both an email and an in-app request;
 * an outside address is named by email and gets the email.
 */

test('connections and outside addresses go in one list', () => {
  const {value} = inviteRecipients(['u1', 'u2'], 'sam@example.com, kim@example.com');
  assert.deepEqual(value, [
    {userId: 'u1'}, {userId: 'u2'},
    {email: 'sam@example.com'}, {email: 'kim@example.com'},
  ]);
});

test('addresses may be separated by commas, spaces or new lines, and repeats collapse', () => {
  const {value} = inviteRecipients([], 'sam@example.com\nkim@example.com sam@example.com');
  assert.deepEqual(value, [{email: 'sam@example.com'}, {email: 'kim@example.com'}]);
});

test('an invite needs at least one recipient', () => {
  assert.ok(inviteRecipients([], '').problem);
});

test('something that is not an address is refused by name', () => {
  assert.match(inviteRecipients([], 'not-an-address').problem ?? '', /not-an-address/);
});

test('the server takes fifty at a time and no more', () => {
  const many = Array.from({length: 51}, (_, index) => `p${index}@example.com`).join(',');
  assert.match(inviteRecipients([], many).problem ?? '', /50/);
  assert.equal(inviteRecipients([], many.split(',').slice(0, 50).join(',')).problem, undefined);
});
