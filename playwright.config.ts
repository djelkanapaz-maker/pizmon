import { defineConfig, devices } from '@playwright/test';

// E2E runs against the local stack (scripts/local-stack/start.sh) and `next dev`/`next start` on :3000.
// CHROMIUM_PATH lets sandboxes without Playwright's CDN use a system/npm-provided Chromium.
const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    launchOptions: { executablePath, args: executablePath ? ['--no-sandbox', '--disable-gpu'] : [] },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
});
