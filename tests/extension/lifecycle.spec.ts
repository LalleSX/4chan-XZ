import { test, expect, openSettings, readStorage } from './fixtures';

test('fresh installation starts the worker, content script and first-run settings', async ({ extension }) => {
  const manifest = await extension.worker.evaluate(() => chrome.runtime.getManifest());
  expect(manifest.name).toBe('4chan-XZ');
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.background).toHaveProperty('service_worker', 'eventPage.js');
  const page = await extension.openBoard();
  await expect(page.locator('#fourchanx-settings')).toBeVisible();
  await expect.poll(() => readStorage(extension.worker, 'sync', 'previousversion')).toBe(manifest.version);
  // This immutable page global is installed by chrome.scripting from the worker.
  await expect.poll(() => page.evaluate(() => (window as Window & { fourchanXT?: { version: string } }).fourchanXT?.version)).toBe(manifest.version);
  await page.locator('#fourchanx-settings .close').click();
  await expect(page.locator('#fourchanx-settings')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.settings-link')).toBeVisible();
  await expect(page.locator('#fourchanx-settings')).toHaveCount(0);
});

test('UI contract: settings live on the board, with no toolbar popup or options page', async ({ extension }) => {
  const manifest = await extension.worker.evaluate(() => chrome.runtime.getManifest());
  // A real popup test is inapplicable; fail here if the product introduces one.
  expect(manifest.action?.default_popup).toBeUndefined();
  expect(manifest.browser_action?.default_popup).toBeUndefined();
  expect(manifest.options_page).toBeUndefined();
  expect(manifest.options_ui).toBeUndefined();
  const page = await extension.openBoard();
  for (const section of ['Main', 'Filter', 'Sauce', 'Advanced', 'Keybinds']) {
    await openSettings(page, section);
  }
  await page.locator('#fourchanx-settings .close').click();
  await expect(page.locator('#overlay')).toHaveCount(0);
  await openSettings(page);
});

test('settings persist through sync storage and change content-script DOM after reload', async ({ extension }) => {
  const page = await extension.openBoard();
  const panel = await openSettings(page);
  const anonymize = panel.locator('input[name="Anonymize"]');
  await anonymize.check();
  await expect.poll(() => readStorage(extension.worker, 'sync', 'Anonymize')).toBe(true);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/\banonymize\b/);
  const second = await extension.openBoard();
  await expect(second.locator('html')).toHaveClass(/\banonymize\b/);
  await (await openSettings(second)).locator('input[name="Anonymize"]').uncheck();
  await expect.poll(() => readStorage(extension.worker, 'sync', 'Anonymize')).toBe(false);
  await page.reload();
  await expect(page.locator('.settings-link')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/\banonymize\b/);
});

test('native extension is disabled through the worker-to-main-world bridge', async ({ extension }) => {
  const page = await extension.openBoard();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('4chan-settings') || '{}').disableAll)).toBe(true);
  const permissions = await extension.worker.evaluate(() => chrome.permissions.getAll());
  expect(permissions.permissions).toEqual(expect.arrayContaining(['storage', 'scripting', 'webRequest']));
  expect(permissions.origins).not.toContain('*://*/');
});
