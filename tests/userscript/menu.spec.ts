import { test, expect } from './fixtures.js';

type MenuHarnessWindow = Window & {
  __menuTest?: {
    copies: string[];
    reports: { url: string; features: string }[];
  };
};

test('post menus switch context, copy the selected post, and build report and archive links', async ({ userscript }) => {
  const page = await userscript.openBoard();
  await page.locator('#fourchanx-settings .close').click();
  // The minimal fixture theme needs room for an open menu between posts.
  await page.addStyleTag({ content: '.postContainer { min-height: 400px; }' });
  await page.evaluate(() => {
    const state: NonNullable<MenuHarnessWindow['__menuTest']> = { copies: [], reports: [] };
    Object.assign(window, { __menuTest: state });
    document.execCommand = command => {
      if (command === 'copy' && document.activeElement instanceof HTMLTextAreaElement) {
        state.copies.push(document.activeElement.value);
      }
      return true;
    };
    window.open = (url, _target, features) => {
      state.reports.push({ url: String(url), features: features ?? '' });
      return null;
    };
  });

  const menu = page.locator('#menu');
  const firstButton = page.locator('#pi100 .menu-button');
  const replyButton = page.locator('#pi101 .menu-button');
  await firstButton.click();
  await expect(menu).toBeVisible();
  await expect(firstButton).toHaveClass(/\bactive\b/);
  await expect(menu.locator('.download-link')).toHaveCount(0);
  await expect(menu.locator('.delete-file')).toHaveCount(0);
  await expect(menu.locator('a[target="_blank"]').filter({ hasText: /^Post$/ })).toHaveAttribute('href', /\/g\/thread\/100\/?#(?:p)?100$/);
  await menu.locator('.copy-text-link').click();

  await replyButton.click();
  await expect(page.locator('#menu')).toHaveCount(1);
  await expect(firstButton).not.toHaveClass(/\bactive\b/);
  await expect(replyButton).toHaveClass(/\bactive\b/);
  await menu.locator('.copy-text-link').click();
  await expect(page.locator('.copy-text-element')).toHaveCount(0);
  expect(await page.evaluate(() => (window as MenuHarnessWindow).__menuTest?.copies))
    .toEqual(['QA ordinary text', 'QA blocked text']);
  await menu.locator('.report-link').click();
  expect(await page.evaluate(() => (window as MenuHarnessWindow).__menuTest?.reports))
    .toEqual([{ url: '//sys.4chan.org/g/imgboard.php?mode=report&no=101', features: expect.stringContaining('width=400,height=550') }]);

  await page.evaluate(() => { document.cookie = 'pass_enabled=1'; });
  await replyButton.click();
  await expect(menu).toHaveCount(0);
  await replyButton.click();
  await menu.locator('.report-link').click();
  expect(await page.evaluate(() => (window as MenuHarnessWindow).__menuTest?.reports[1]?.features))
    .toContain('width=350,height=275');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(replyButton).toBeFocused();
});

test('post deletion submits the selected post and permits retry after a server error', async ({ userscript }) => {
  const page = await userscript.openBoard();
  await page.locator('#fourchanx-settings .close').click();
  await page.evaluate(() => {
    const original = document.getElementById('delform')!;
    const form = document.createElement('form');
    form.id = original.id;
    form.action = 'https://sys.4chan.org/g/imgboard.php';
    form.append(...original.childNodes);
    original.replaceWith(form);
  });
  const requests: string[] = [];
  await page.route('https://sys.4chan.org/g/imgboard.php', async route => {
    requests.push(route.request().postData() ?? '');
    await route.fulfill({
      contentType: 'text/html',
      headers: {
        'access-control-allow-origin': 'https://boards.4chan.org',
        'access-control-allow-credentials': 'true',
      },
      body: requests.length === 1
        ? '<title>Error</title><div id="errmsg">Incorrect password</div>'
        : '<title>Updating index...</title>',
    });
  });

  await page.locator('#pi101 .menu-button').click();
  await page.locator('#menu .delete-link').hover();
  await page.locator('#menu .delete-post').click();
  await expect(page.locator('.notification.warning').filter({ hasText: 'Incorrect password' })).toBeVisible();
  await page.locator('#menu .delete-post').click();
  await expect(page.locator('#menu .delete-post')).toHaveText('Deleted');
  expect(requests).toHaveLength(2);
  for (const body of requests) {
    expect(body).toContain('name="mode"\r\n\r\nusrdel');
    expect(body).toContain('name="101"\r\n\r\ndelete');
    expect(body).not.toContain('name="onlyimgdel"');
  }
});
