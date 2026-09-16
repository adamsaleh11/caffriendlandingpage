import test from 'node:test';
import assert from 'node:assert/strict';
import { meetingCounterpart } from '../src/lib/upcoming.ts';
import { meetingParticipants } from '../src/lib/crm-projection.ts';

/**
 * Who a meeting is with.
 *
 * The organizer is not in the participant rows for a desktop-booked meeting, so the
 * first entry is the counterpart. Falling back to the organizer is what labelled every
 * desktop-booked coffee with the name of the member reading the page.
 */

const meeting = (rows) => ({
  id: 'm1', purpose: 'Coffee chat', status: 'CONFIRMED',
  startsAt: '2026-09-15T10:00:00.000Z', endsAt: '2026-09-15T10:30:00.000Z',
  meetingParticipantMeetingRows: rows,
});

test('the linked person names the meeting ahead of the invited address', () => {
  assert.equal(meetingCounterpart(meeting([
    {displayName: 'sam@example.com', email: 'sam@example.com', person: {displayName: 'Sam Okonkwo'}},
  ])), 'Sam Okonkwo');
});

test('an invitee with no person record is named from the invitation', () => {
  assert.equal(meetingCounterpart(meeting([{displayName: 'Jordan Lee', email: 'jordan@example.com', person: null}])), 'Jordan Lee');
  assert.equal(meetingCounterpart(meeting([{displayName: null, email: 'jordan@example.com', person: null}])), 'jordan@example.com');
  assert.equal(meetingCounterpart(meeting([{displayName: null, email: null, person: null}])), 'Unknown');
});

test('a meeting booked with nobody invited names nobody', () => {
  assert.equal(meetingCounterpart(meeting([])), null);
  assert.equal(meetingCounterpart({id: 'm1', purpose: '', status: 'CONFIRMED', startsAt: '', endsAt: ''}), null);
});

/**
 * The boundary copies a name and an address and nothing else: anything the backend
 * later adds inside these rows — an account id above all — stays server-side.
 */
test('only a name and an address cross the projection boundary', () => {
  assert.deepEqual(meetingParticipants([
    {displayName: 'Jordan Lee', email: 'jordan@example.com', userId: 'u-9',
     person: {displayName: 'Jordan Lee', id: 'p-3', linkedUserId: 'u-9'}},
  ]), [{displayName: 'Jordan Lee', email: 'jordan@example.com', person: {displayName: 'Jordan Lee'}}]);
  assert.deepEqual(meetingParticipants(undefined), []);
});
