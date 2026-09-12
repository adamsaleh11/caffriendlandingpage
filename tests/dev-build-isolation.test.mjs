import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loadConfig = require('next/dist/server/config').default;
const {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
} = require('next/constants');

test('development and production builds use separate artifact directories', async () => {
  const projectDir = new URL('..', import.meta.url).pathname;
  const development = await loadConfig(PHASE_DEVELOPMENT_SERVER, projectDir);
  const production = await loadConfig(PHASE_PRODUCTION_BUILD, projectDir);

  assert.notEqual(
    development.distDir,
    production.distDir,
    'next dev and next build must not overwrite each other\'s manifests',
  );
});
