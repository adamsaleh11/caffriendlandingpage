import test from 'node:test';
import assert from 'node:assert/strict';
import { seatOfIdentity } from '../src/lib/call.ts';

/**
 * A LiveKit identity is composite — the account (or a `guest-` stand-in) joined to the
 * seat by an underscore. A tile finds its video by the seat half. Comparing the whole
 * identity to a userId, which is what the media layer used to do, matched nobody, so
 * nobody's camera ever appeared and the call looked like a room of still avatars.
 */

test("a signed-in member's seat is the segment after the last underscore", () => {
  assert.equal(seatOfIdentity('11111111-1111-1111-1111-111111111111_p456'), 'p456');
});

test('a guest identity names the seat too, despite having no account', () => {
  assert.equal(seatOfIdentity('guest-p456_p456'), 'p456');
});

test('a userId that itself contains an underscore does not steal the seat', () => {
  assert.equal(seatOfIdentity('auth0_user_9_seat42'), 'seat42');
});
