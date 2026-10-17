import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { test, expect, bundlePath, packageJson, version, ready, openSettings, readStorage, type HarnessWindow } from './fixtures.js';

test('installable metadata and JavaScript match the development build contract', async ({ bundle }) => {
  const path = bundlePath(bundle);
  const source = await readFile(path, 'utf8');
  const header = source.match(/^\/\/ ==UserScript==\r?\n[\s\S]*?^\/\/ ==\/UserScript==\r?\n/m)?.[0];
  expect(source.startsWith('// ==UserScript==\n')).toBe(true);
  expect(header).toBeDefined();
  const fields = new Map<string, string[]>();
  for (const match of header!.matchAll(/^\/\/ @(\S+)\s+(.+)$/gm)) {
    fields.set(match[1], [...(fields.get(match[1]) ?? []), match[2].trim()]);
  }
  expect(fields.get('name')).toEqual([packageJson.meta.name]);
  expect(fields.get('version')).toEqual([version]);
  expect(fields.get('namespace')).toEqual([packageJson.name]);
  expect(fields.get('run-at')).toEqual(['document-start']);
  expect(fields.get('updateURL')).toEqual(['none']);
  expect(fields.get('downloadURL')).toEqual(['none']);
  expect(fields.get('grant')).toEqual(packageJson.meta.grants);
  expect(fields.get('include')).toEqual([
    ...packageJson.meta.includes_only, ...packageJson.meta.matches, ...packageJson.meta.matches_extra,
  ]);
  expect(fields.get('exclude')).toEqual(packageJson.meta.exclude_matches);
  expect(await readFile(path.replace(/\.user\.js$/, '.meta.js'), 'utf8')).toBe(header);
  expect(() => new Script(source, { filename: path })).not.toThrow();
});

test('fresh install initializes once, opens settings, and survives reload', async ({ userscript }) => {
  const page = await userscript.openBoard();
  await expect(page.locator('#fourchanx-settings')).toBeVisible();
  await expect.poll(() => readStorage(page, 'previousversion')).toBe(version);
  expect(await page.evaluate(() => (window as HarnessWindow).fourchanXT?.version)).toBe(version);
  const stats = await page.evaluate(() => (window as HarnessWindow).__userscriptTest);
  expect(stats?.reads).toBeGreaterThan(0);
  expect(stats?.writes).toBeGreaterThan(0);
  await page.locator('#fourchanx-settings .close').click();
  await page.reload();
  await ready(page);
  await expect(page.locator('#fourchanx-settings')).toHaveCount(0);
});

test('all settings tabs open and the page-context bridge disables the native extension', async ({ userscript }) => {
  const page = await userscript.openBoard();
  for (const section of ['Main', 'Filter', 'Sauce', 'Advanced', 'Keybinds']) await openSettings(page, section);
  await page.locator('#fourchanx-settings .close').click();
  await expect(page.locator('#overlay')).toHaveCount(0);
  await openSettings(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('4chan-settings') ?? '{}').disableAll)).toBe(true);
});

test('GM settings persist across reloads and tabs and can be turned off', async ({ userscript }) => {
  const page = await userscript.openBoard();
  await (await openSettings(page)).locator('input[name="Anonymize"]').check();
  await expect.poll(() => readStorage(page, 'Anonymize')).toBe(true);
  await page.reload();
  await ready(page);
  await expect(page.locator('html')).toHaveClass(/\banonymize\b/);
  const second = await userscript.openBoard();
  await expect(second.locator('html')).toHaveClass(/\banonymize\b/);
  await (await openSettings(second)).locator('input[name="Anonymize"]').uncheck();
  await expect.poll(() => readStorage(second, 'Anonymize')).toBe(false);
  await page.reload();
  await ready(page);
  await expect(page.locator('html')).not.toHaveClass(/\banonymize\b/);
});

test('a UI-created filter hides only its matching reply and disabling it restores the reply', async ({ userscript }) => {
  const page = await userscript.openBoard();
  const panel = await openSettings(page, 'Filter');
  await panel.locator('input[name="Filter"]').uncheck();
  await expect.poll(() => readStorage(page, 'Filter')).toBe(false);
  await panel.locator('input[name="Filter"]').check();
  await panel.getByLabel('Filter field', { exact: true }).selectOption('comment');
  await panel.locator('[data-field="value"]').fill('QA blocked text');
  await panel.locator('.filter-options > summary').click();
  await panel.locator('[data-field="stub"]').selectOption('no');
  await panel.getByRole('button', { name: 'Add rule', exact: true }).click();
  await expect(panel.locator('.filter-rule-row').filter({ hasText: 'QA blocked text' })).toHaveCount(1);
  await expect.poll(() => readStorage(page, 'comment')).toContain('QA blocked text');
  await expect.poll(() => readStorage(page, 'Filter')).toBe(true);
  await page.reload();
  await ready(page);
  await expect(page.locator('#pc101')).toHaveCount(1);
  await expect(page.locator('#pc101')).toBeHidden();
  await expect(page.locator('#pc100')).toBeVisible();
  await expect(page.locator('#pc102')).toBeVisible();
  await expect(page.locator('#m102')).toHaveText('QA ordinary text');
  const reopened = await openSettings(page, 'Filter');
  await reopened.getByLabel('Filter field', { exact: true }).selectOption('comment');
  await reopened.locator('.filter-rule-row').filter({ hasText: 'QA blocked text' }).getByRole('checkbox').uncheck();
  await expect.poll(() => readStorage(page, 'comment')).toMatch(/^#.*QA blocked text/m);
  await page.reload();
  await ready(page);
  await expect(page.locator('#pc101')).toBeVisible();
});

test('reinjection does not initialize twice or duplicate settings controls', async ({ userscript }) => {
  const page = await userscript.openBoard();
  await page.locator('#fourchanx-settings .close').click();
  await page.addScriptTag({ content: userscript.source });
  await ready(page);
  await expect(page.locator('.settings-link')).toHaveCount(1);
  await expect(page.locator('html')).not.toHaveClass(/\btainted\b/);
  await openSettings(page);
  await expect(page.locator('#fourchanx-settings')).toHaveCount(1);
});
