import { defineConfig } from '@playwright/test';
const executablePath = process.env.CHROMIUM_PATH || undefined;
export default defineConfig({
  testDir: '.', testMatch: '*capture.spec.ts', timeout: 1_500_000, workers: 1, reporter: [['list']],
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000', browserName: 'chromium', launchOptions: { executablePath, args: executablePath ? ['--no-sandbox', '--disable-gpu'] : [] } },
});
