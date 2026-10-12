import { test, expect, openSettings, readStorage } from './fixtures';

test('a rule created in settings hides only the matching production post after reload', async ({ extension }) => {
  const page = await extension.openBoard();
  const panel = await openSettings(page, 'Filter');
  await panel.locator('input[name="Filter"]').check();
  await panel.getByLabel('Filter field', { exact: true }).selectOption('comment');
  await panel.locator('[data-field="value"]').fill('QA blocked text');
  await panel.locator('.filter-options > summary').click();
  await panel.locator('[data-field="stub"]').selectOption('no');
  await panel.getByRole('button', { name: 'Add rule', exact: true }).click();
  await expect(panel.locator('.filter-rule-list code')).toContainText('QA blocked text');
  await expect.poll(() => readStorage(extension.worker, 'sync', 'comment')).toContain('QA blocked text');
  await expect.poll(() => readStorage(extension.worker, 'sync', 'Filter')).toBe(true);
  await page.reload();
  await expect(page.locator('#pc101')).toHaveCount(1);
  await expect(page.locator('#pc101')).toBeHidden();
  await expect(page.locator('#pc102')).toBeVisible();
  await expect(page.locator('#m102')).toHaveText('QA ordinary text');
  // Disable via the actual editor, then verify that reload restores the post.
  const reopened = await openSettings(page, 'Filter');
  await reopened.getByLabel('Filter field', { exact: true }).selectOption('comment');
  await reopened.getByRole('checkbox', { name: 'Enable rule on line 1', exact: true }).uncheck();
  await expect.poll(() => readStorage(extension.worker, 'sync', 'comment')).toMatch(/^#/);
  await page.reload();
  await expect(page.locator('#pc101')).toBeVisible();
});
