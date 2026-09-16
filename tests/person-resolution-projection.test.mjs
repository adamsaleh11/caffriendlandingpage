import test from 'node:test';
import assert from 'node:assert/strict';
import { projectResolvePage } from '../src/lib/crm-projection.ts';

/**
 * The client boundary for resolving an outreach email to a person.
 *
 * The response carries a consumer profile, so the projection is a whitelist like
 * every other: a column the server adds later is withheld until it is named here,
 * rather than reaching the browser the day it ships.
 */

const entry = {
  email: 'sam.jones@acme.com',
  status: 'CONNECTION',
  userId: 'u1',
  existingPersonId: null,
  profile: {
    displayName: 'Sam Jones', title: 'Staff Engineer', company: 'Acme',
    organizationId: 'o1', location: 'Toronto',
    sourceUrl: 'https://www.linkedin.com/in/samjones', image: 'https://cdn/a.jpg',
    // Columns the account carries that an outreach draft has no business reading.
    phone: '+1-555-0100', billingId: 'b1', email: 'other@acme.com',
  },
};

test('a resolved entry discloses only the whitelisted fields', () => {
  const {items} = projectResolvePage({items: [entry]});
  assert.deepEqual(Object.keys(items[0]).sort(), ['email', 'existingPersonId', 'profile', 'status', 'userId']);
});

test('a resolved profile discloses only the whitelisted fields, never contact or billing', () => {
  const {items} = projectResolvePage({items: [entry]});
  assert.deepEqual(Object.keys(items[0].profile).sort(), [
    'company', 'displayName', 'image', 'location', 'organizationId', 'sourceUrl', 'title',
  ]);
});

test('a NO_ACCOUNT entry carries no profile at all', () => {
  const {items} = projectResolvePage({items: [{email: 'nobody@example.com', status: 'NO_ACCOUNT', userId: null, existingPersonId: null, profile: null}]});
  assert.equal(items[0].profile, null);
  assert.equal(items[0].status, 'NO_ACCOUNT');
});

test('a malformed body reads as empty rather than throwing', () => {
  assert.deepEqual(projectResolvePage(null), {items: []});
});
