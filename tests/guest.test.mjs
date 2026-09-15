import test from 'node:test';
import assert from 'node:assert/strict';
import { anonymousInstallId, storedInstallId, claimGuestHistory } from '../src/lib/guest.ts';

/** A browser with a working localStorage and a recordable fetch. */
function browser() {
  const store = new Map();
  const calls = [];
  globalThis.window = {localStorage: {
    getItem: key => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => { store.set(key, value); },
  }};
  globalThis.fetch = async (url, options) => { calls.push({url, options}); return {ok: true, json: async () => ({})}; };
  return calls;
}

test('the guest id is minted once and then kept', () => {
  browser();
  const first = anonymousInstallId();
  assert.match(first, /^[0-9a-f-]{36}$/);
  assert.equal(anonymousInstallId(), first, 'the same install keeps the same id');
});

test('claiming sends the stored guest id', async () => {
  const calls = browser();
  const id = anonymousInstallId();
  await claimGuestHistory();
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /claim-guest$/);
  assert.equal(JSON.parse(calls[0].options.body).anonymousInstallId, id);
});

test('someone who was never a guest claims nothing', async () => {
  const calls = browser();
  assert.equal(storedInstallId(), null);
  await claimGuestHistory();
  assert.equal(calls.length, 0, 'no guest history, no call');
});

test('a browser that refuses storage still yields a usable id and never throws', async () => {
  globalThis.window = {localStorage: {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  }};
  globalThis.fetch = async () => ({ok: true, json: async () => ({})});
  assert.match(anonymousInstallId(), /^[0-9a-f-]{36}$/);
  assert.equal(storedInstallId(), null);
  await claimGuestHistory();
});
