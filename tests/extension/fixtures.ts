import { test as base, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

export const boardURL = 'https://boards.4chan.org/g/thread/100';
// Local synthetic board markup is fulfilled at a permitted HTTPS origin so the
// browser itself injects the unmodified production content script.
const html = `<!doctype html><html><head><title>/g/ - QA fixture</title></head>
<body><div id="boardNavDesktop"><span class="boardList">[<a href="/g/">g</a>]</span><span></span></div>
<div class="boardBanner"><div class="boardTitle">/g/ - Technology</div></div>
<div id="boardNavDesktopFoot"><span class="boardList">[<a href="/g/">g</a>]</span></div>
<div id="delform"><div class="board"><div class="thread" id="t100">
${[100, 101, 102].map(id => `<div class="postContainer ${id === 100 ? 'opContainer' : 'replyContainer'}" id="pc${id}">
<div class="sideArrows">&gt;&gt;</div><div class="post ${id === 100 ? 'op' : 'reply'}" id="p${id}">
<div class="postInfo" id="pi${id}"><input type="checkbox" name="${id}"><span class="subject"></span>
<span class="nameBlock"><span class="name">QA author</span></span>
<span class="dateTime" data-utc="1700000000">11/14/23</span>
<span class="postNum"><a href="#p${id}">No.</a><a href="javascript:;">${id}</a></span></div>
<blockquote class="postMessage" id="m${id}">${id === 101 ? 'QA blocked text' : 'QA ordinary text'}</blockquote>
</div></div>`).join('')}
</div></div></div></body></html>`;

type Extension = {
  context: BrowserContext;
  worker: Worker;
  profile: string;
  openBoard: () => Promise<Page>;
};

export const test = base.extend<{ extension: Extension }>({
  extension: async ({ playwright }, use, testInfo) => {
    const profile = await mkdtemp(join(tmpdir(), '4chan-xz-e2e-'));
    const path = resolve('dist/crx');
    let context: BrowserContext | undefined;
    try {
      context = await playwright.chromium.launchPersistentContext(profile, {
        channel: 'chromium',
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
        headless: true,
        ignoreDefaultArgs: ['--disable-extensions'],
        args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`],
        serviceWorkers: 'allow',
      });
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      const worker = context.serviceWorkers().find(w => w.url().endsWith('/eventPage.js'))
        ?? await context.waitForEvent('serviceworker', {
          predicate: w => w.url().endsWith('/eventPage.js'),
          timeout: 10_000,
        });
      // Fail closed: tests must never depend on a real board, ads, or third parties.
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === 'https://boards.4chan.org' && url.pathname === '/g/thread/100') {
          await route.fulfill({ contentType: 'text/html', body: html });
        } else if (url.href === 'https://a.4cdn.org/boards.json') {
          await route.fulfill({ json: { boards: [{ board: 'g', title: 'Technology', ws_board: 1 }] } });
        } else {
          await route.abort('blockedbyclient');
        }
      });
      await use({
        context, worker, profile,
        openBoard: async () => {
          const page = await context!.newPage();
          await page.goto(boardURL);
          await expect(page.locator('html')).toHaveClass(/fourchan-x/);
          await expect(page.locator('.settings-link')).toBeVisible();
          return page;
        },
      });
    } finally {
      // Closing Chromium releases its profile and service worker before deletion.
      try {
        if (context) {
          try {
            if (testInfo.status !== testInfo.expectedStatus) {
              const trace = testInfo.outputPath('trace.zip');
              await context.tracing.stop({ path: trace });
              await testInfo.attach('trace', { path: trace, contentType: 'application/zip' });
            } else {
              await context.tracing.stop();
            }
          } finally {
            await context.close();
          }
        }
      } finally {
        await rm(profile, { recursive: true, force: true });
      }
    }
  },
});

export { expect };

export async function openSettings(page: Page, section = 'Main') {
  const panel = page.locator('#fourchanx-settings');
  if (!await panel.isVisible()) await page.locator('.settings-link').click();
  await expect(panel).toBeVisible();
  await panel.locator(`.tab-${section.toLowerCase()}`).click();
  await expect(panel.locator(`.section-${section.toLowerCase()}`)).toBeVisible();
  return panel;
}

export async function readStorage(worker: Worker, area: 'local' | 'sync', key: string) {
  return worker.evaluate(async ({ area, key }) => (await chrome.storage[area].get(key))[key], { area, key });
}
