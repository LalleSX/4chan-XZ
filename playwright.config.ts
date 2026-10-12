import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/extension',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Each test owns a real profile. Serial execution also keeps CI memory bounded.
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
});
