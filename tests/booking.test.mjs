import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingRequest } from '../src/lib/contracts.ts';

/**
 * What the desktop sends to book a coffee chat. `venue` is chosen by the sender and is
 * never inferred; the legacy `type` / `conference` keys are a 400 alongside it.
 */

const draft = (over) => ({
  purpose: 'Coffee', startsAt: '2026-10-01T15:00:00.000Z', endsAt: '2026-10-01T15:30:00.000Z',
  timezone: 'America/Toronto', attendees: ['sam@example.com'], engagementId: 'eng-1',
  venue: 'CAFFRIEND_LIVEKIT', ...over,
});

test('a Caffriend call needs no calendar connection', () => {
  const body = bookingRequest(draft({}));
  assert.equal(body.problem, undefined);
  assert.equal(body.value.venue, 'CAFFRIEND_LIVEKIT');
  assert.ok(!('connectionId' in body.value), 'no connection is sent for a Caffriend call');
});

test('the legacy type and conference keys are never sent', () => {
  const body = bookingRequest(draft({}));
  assert.ok(!('type' in body.value));
  assert.ok(!('conference' in body.value));
  assert.ok(!('conferenceRequested' in body.value));
});

test('Google Meet is refused without a connection and carries one when given', () => {
  assert.match(bookingRequest(draft({venue: 'PROVIDER_CONFERENCE'})).problem ?? '', /Google/);
  const ok = bookingRequest(draft({venue: 'PROVIDER_CONFERENCE', connectionId: 'conn-1'}));
  assert.equal(ok.problem, undefined);
  assert.equal(ok.value.connectionId, 'conn-1');
});

test('in person is not a venue the desktop offers', () => {
  assert.ok(bookingRequest(draft({venue: 'IN_PERSON', physicalLocation: 'Cafe'})).problem);
});

test('a booking needs an engagement, an attendee and a real interval', () => {
  assert.ok(bookingRequest(draft({engagementId: ''})).problem);
  assert.ok(bookingRequest(draft({attendees: []})).problem);
  assert.ok(bookingRequest(draft({endsAt: '2026-10-01T14:00:00.000Z'})).problem);
  assert.ok(bookingRequest(draft({timezone: 'Nowhere/Nothing'})).problem);
});
