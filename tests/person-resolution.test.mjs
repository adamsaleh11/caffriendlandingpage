import test from 'node:test';
import assert from 'node:assert/strict';
import { noticeFor, personDraftFrom, personPlanFor } from '../src/lib/person-resolution.ts';

/**
 * What a sender is told about who they are about to invite.
 *
 * The server answers with two statuses, not three. `NO_ACCOUNT` covers a person
 * with no Caffriend account, an account the sender has never met, and a malformed
 * address alike — deliberately, so the invite box cannot be used to ask whether an
 * address belongs to an account. So the notice may only claim what is true of all
 * three: they will answer from the email link as a guest.
 */

test('a Connection is announced as one, because a Connection is what follows', () => {
  const notice = noticeFor({email: 'sam@acme.com', status: 'CONNECTION', profile: {displayName: 'Sam Jones'}});
  assert.equal(notice.tone, 'connection');
  assert.match(notice.message, /Sam Jones/);
});

test('an unresolved address promises only a guest answer, never "no Caffriend account"', () => {
  const notice = noticeFor({email: 'nobody@example.com', status: 'NO_ACCOUNT', profile: null});
  assert.equal(notice.tone, 'guest');
  assert.match(notice.message, /guest/i);
  // The status also covers an account the sender has never met, so the copy must
  // not assert that no account exists.
  assert.doesNotMatch(notice.message, /no Caffriend account/i);
});

test('a status no client release has seen reads as a guest rather than as a Connection', () => {
  assert.equal(noticeFor({email: 'x@y.com', status: 'SOMETHING_NEW', profile: null}).tone, 'guest');
});

/**
 * The record written for a recipient who has no person yet.
 *
 * A resolved Connection fills in what the account already knows. Everything else
 * keeps today's behaviour: a display name derived from the address, and nothing
 * invented to pad the record out.
 */

const resolved = (over = {}) => ({
  email: 'sam.jones@acme.com', status: 'CONNECTION', userId: 'u1', existingPersonId: null,
  profile: {
    displayName: 'Sam Jones', title: 'Staff Engineer', company: 'Acme', organizationId: 'o1',
    location: 'Toronto', sourceUrl: 'https://www.linkedin.com/in/samjones', image: null,
  }, ...over,
});

test('a resolved Connection is written from the account, and marked as one', () => {
  const draft = personDraftFrom(resolved());
  assert.equal(draft.displayName, 'Sam Jones');
  assert.equal(draft.title, 'Staff Engineer');
  assert.equal(draft.location, 'Toronto');
  assert.equal(draft.sourceUrl, 'https://www.linkedin.com/in/samjones');
  assert.equal(draft.organizationId, 'o1');
  assert.equal(draft.email, 'sam.jones@acme.com');
  assert.equal(draft.sourceCategory, 'CONNECTION');
});

/** Live records carry trailing spaces — `'Co-Founder '`, `'Caffriend '` — so they are trimmed. */
test('whitespace around an account field does not reach the record', () => {
  const draft = personDraftFrom(resolved({profile: {displayName: ' Shil Patel ', title: 'Co-Founder ', location: 'Ontario'}}));
  assert.equal(draft.displayName, 'Shil Patel');
  assert.equal(draft.title, 'Co-Founder');
});

test('company is never written to the person, which holds an organization id instead', () => {
  assert.equal('company' in personDraftFrom(resolved()), false);
});

test('a field the account does not have is left out, never filled with a placeholder', () => {
  const draft = personDraftFrom(resolved({profile: {displayName: 'Sam Jones', title: null, location: null, organizationId: null}}));
  assert.equal('title' in draft, false);
  assert.equal('organizationId' in draft, false);
  assert.equal(JSON.stringify(draft).includes('Unknown'), false);
});

test('an unresolved address keeps today\'s name derived from the address', () => {
  const draft = personDraftFrom({email: 'jordan.lee@example.com', status: 'NO_ACCOUNT', profile: null});
  assert.equal(draft.displayName, 'Jordan Lee');
  assert.equal(draft.sourceCategory, 'MANUAL');
});

/**
 * Which person an invitation is tracked against.
 *
 * Duplicates are fixed here rather than by a constraint: the server names the
 * person this workspace already has for an address, and the composer reuses it
 * instead of minting a second. Sending twice must not create two people.
 */

test('a person the composer already holds is used as-is, without resolving anything', () => {
  const plan = personPlanFor({email: 'sam@acme.com', person: {id: 'p9'}}, undefined);
  assert.deepEqual(plan, {personId: 'p9'});
});

test('a person the workspace already has for this address is reused, never duplicated', () => {
  const plan = personPlanFor({email: 'sam@acme.com'}, resolved({existingPersonId: 'p1'}));
  assert.deepEqual(plan, {personId: 'p1'});
});

/** An address with no account can still be someone this workspace already tracks. */
test('reuse does not depend on the address resolving to a Connection', () => {
  const plan = personPlanFor({email: 'ig@e.com'}, {email: 'ig@e.com', status: 'NO_ACCOUNT', existingPersonId: 'p2', profile: null});
  assert.deepEqual(plan, {personId: 'p2'});
});

test('an address with no person yet is created from what the account knows', () => {
  const plan = personPlanFor({email: 'sam.jones@acme.com'}, resolved());
  assert.equal(plan.personId, undefined);
  assert.equal(plan.create.displayName, 'Sam Jones');
  assert.equal(plan.create.sourceCategory, 'CONNECTION');
});

/** Resolution is best-effort: losing it must never stop an invitation going out. */
test('an address that was never resolved still gets today\'s record', () => {
  const plan = personPlanFor({email: 'jordan.lee@example.com'}, undefined);
  assert.equal(plan.create.displayName, 'Jordan Lee');
  assert.equal(plan.create.sourceCategory, 'MANUAL');
});
