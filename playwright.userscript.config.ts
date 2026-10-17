import { defineConfig } from '@playwright/test';
import type { UserscriptOptions } from './tests/userscript/fixtures.js';

export default defineConfig<UserscriptOptions>({
  testDir: './tests/userscript',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/userscript', open: 'never' }]],
  outputDir: 'test-results/userscript',
  use: {
    browserName: 'chromium',
    headless: true,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    },
  },
  projects: (['readable', 'minified'] as const).flatMap(bundle =>
    (['legacy', 'modern'] as const).map(api => ({
      name: `${bundle}-${api}`,
      use: { bundle, api },
    }))),
});
