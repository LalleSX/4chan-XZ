import { test as base, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { boardURL, boards, html } from './board.js';
import { installManager, storagePrefix, type Api } from './manager.js';

export type UserscriptOptions = { bundle: 'readable' | 'minified'; api: Api };
type Userscript = { openBoard: () => Promise<Page>; source: string };
export type HarnessWindow = Window & {
  __userscriptTest?: { reads: number; writes: number; initEvents: number };
  fourchanXT?: { version: string };
};
const root = new URL('../../', import.meta.url);
export const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
export const version = JSON.parse(await readFile(new URL('version.json', root), 'utf8')).version as string;
export const bundlePath = (bundle: UserscriptOptions['bundle']) => fileURLToPath(
  new URL(`dist/${packageJson.meta.path}${bundle === 'minified' ? '.min' : ''}.user.js`, root),
);

export const test = base.extend<UserscriptOptions & { userscript: Userscript }>({
  bundle: ['readable', { option: true }],
  api: ['legacy', { option: true }],
  userscript: async ({ context, bundle, api }, use, testInfo) => {
    const source = await readFile(bundlePath(bundle), 'utf8');
    const errors: string[] = [];
    const blocked: string[] = [];
    context.on('page', page => {
      page.on('pageerror', error => errors.push(error.stack ?? error.message));
      page.on('console', message => {
        // Browser network diagnostics have no JS arguments. Production catches
        // many feature exceptions and logs them, so pageerror alone is not enough.
        if (message.type() === 'error' && message.args().length) errors.push(message.text());
      });
    });
    await context.route('**/*', async route => {
      const url = route.request().url();
      if (url === boardURL && route.request().isNavigationRequest()) {
        await route.fulfill({ contentType: 'text/html', body: html });
      } else if (url === 'https://a.4cdn.org/boards.json') {
        await route.fulfill({ json: boards, headers: { 'access-control-allow-origin': '*' } });
      } else if (url === 'https://boards.4chan.org/test-yotsuba.css') {
        await route.fulfill({ contentType: 'text/css', body: 'body { background: #ffe; }' });
      } else {
        blocked.push(url);
        await route.abort('blockedbyclient');
      }
    });
    // One init script guarantees manager setup precedes the unmodified bundle.
    // Scope injection to the fixture top frame, as a manager would with matches.
    await context.addInitScript({ content: `if (window.top === window && location.href === ${JSON.stringify(boardURL)}) {
      (${installManager.toString()})(${JSON.stringify({ api, prefix: storagePrefix })});
      const run = () => {
        ${source}
      };
      // Playwright init scripts can run before <html> exists. Model injection
      // into the document element, still before the fixture body is parsed.
      if (document.documentElement) run();
      else {
        const observer = new MutationObserver(() => {
          if (!document.documentElement) return;
          observer.disconnect();
          run();
        });
        observer.observe(document, { childList: true });
      }
    }` });
    try {
      await use({
        source,
        openBoard: async () => {
          const page = await context.newPage();
          await page.goto(boardURL);
          await ready(page);
          return page;
        },
      });
    } finally {
      await testInfo.attach('userscript-diagnostics', {
        body: JSON.stringify({ errors, blocked }, null, 2), contentType: 'application/json',
      });
      expect(errors, 'Uncaught errors or production console.error calls').toEqual([]);
    }
  },
});

export { expect };

export async function ready(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).__userscriptTest?.initEvents)).toBe(1);
  await expect(page.locator('html')).toHaveClass(/\bfourchan-x\b/);
  await expect(page.locator('.settings-link')).toBeVisible();
  await expect(page.locator('.notification.error')).toHaveCount(0);
}

export async function openSettings(page: Page, section = 'Main') {
  const panel = page.locator('#fourchanx-settings');
  if (!await panel.isVisible()) await page.locator('.settings-link').click();
  await expect(panel).toBeVisible();
  await panel.locator(`.tab-${section.toLowerCase()}`).click();
  await expect(panel.locator(`.section-${section.toLowerCase()}`)).toBeVisible();
  return panel;
}

// Inspect the manager backing store, not the application's localStorage fallback.
export async function readStorage(page: Page, key: string): Promise<unknown> {
  return page.evaluate(({ prefix, key }) => {
    const raw = localStorage.getItem(prefix + key);
    return raw === null ? undefined : JSON.parse(JSON.parse(raw));
  }, { prefix: storagePrefix, key: packageJson.meta.name + key });
}
