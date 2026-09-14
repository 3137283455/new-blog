import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/writer',
  timeout: 120000,
  expect: { timeout: 15000 },
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3112', browserName: 'chromium', channel: 'chrome', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  reporter: 'list',
});
