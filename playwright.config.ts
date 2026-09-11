import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node tests/backend.mjs', port: 4100, reuseExistingServer: false },
    { command: 'npm run dev -- --port 3100', port: 3100, reuseExistingServer: false,
      env: { CAFFRIEND_API_ORIGIN: 'http://127.0.0.1:4100', CAFFRIEND_WEB_ORIGIN: 'http://localhost:3100', CAFFRIEND_SESSION_SECRET: 'test-only-session-key-at-least-32-characters-long', EARLY_ACCESS_TRANSPORT: 'inert' } }
  ]
});
