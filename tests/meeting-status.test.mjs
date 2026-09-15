import test from 'node:test';
import assert from 'node:assert/strict';
import { joinable, calendarFailed } from '../src/lib/contracts.ts';

/**
 * `FAILED` is the calendar event's verdict, not the meeting's. The call is real and
 * still joinable; the calendar problem is surfaced separately, with a retry.
 */

test('a meeting whose calendar event failed is still joinable', () => {
  assert.equal(joinable('FAILED'), true);
  assert.equal(calendarFailed('FAILED'), true);
});

test('a Caffriend call with no provider involved is joinable and has no calendar problem', () => {
  assert.equal(joinable('LOCAL'), true);
  assert.equal(calendarFailed('LOCAL'), false);
});

test('a cancelled meeting is not joinable', () => {
  assert.equal(joinable('CANCELLED'), false);
  assert.equal(joinable('CANCEL_PENDING'), false);
});

test('a meeting still being sent to a calendar is not yet joinable', () => {
  assert.equal(joinable('PENDING'), false);
  assert.equal(joinable('CONFIRMED'), true);
});
