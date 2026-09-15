import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:3111';

test.use({ viewport: { width: 390, height: 844 } });

async function openControls(page: import('@playwright/test').Page, stage: string) {
  const shell = page.locator('.mobile-reader-shell');
  await expect(shell).toHaveAttribute('data-open', 'false');
  await page.locator(stage).click({ position: { x: 195, y: 360 } });
  await expect(shell).toHaveAttribute('data-open', 'true');
  await expect(page.locator('.mobile-reader-shell__top')).toBeInViewport();
  await expect(page.locator('.mobile-reader-shell__bottom')).toBeInViewport();
}

test('mobile novel uses the shared immersive controls and settings sheet', async ({ page }) => {
  await page.goto(`${origin}/books/ui-fixture/volume/chapter`);
  await openControls(page, '.reading-workspace');
  await page.locator('.mobile-reader-shell__bottom button').filter({ hasText: '设置' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('页边距', { exact: false })).toBeVisible();
  await expect(page.getByRole('dialog').locator('.mobile-reader-music')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('上一首')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('音量', { exact: true })).toBeVisible();
});

test('mobile local manga uses the shared controls without a floating trigger', async ({ page }) => {
  await page.goto(`${origin}/manga/local-fixture/volume-1/chapter-1`);
  await expect(page.locator('.comic .trigger')).toHaveCount(0);
  await openControls(page, '[data-stage]');
  await page.locator('.mobile-reader-shell__bottom button').filter({ hasText: '设置' }).click();
  await expect(page.locator('[data-settings]')).toBeVisible();
  await expect(page.locator('[data-settings] .mobile-reader-music')).toBeVisible();
  await expect(page.locator('[data-settings]').getByLabel('下一首')).toBeVisible();
});

test('mobile network manga uses the same controls and keeps source context', async ({ page }) => {
  await page.goto(`${origin}/source/manga/fixture%3Aalpha/chapter/ep-42?id=book%2F42&title=Reader`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-source-reader]')).toHaveAttribute('data-reader-ready', 'true', { timeout: 45000 });
  const shell = page.locator('.mobile-reader-shell');
  await expect(shell).toHaveAttribute('data-open', 'false');
  await expect(async () => {
    await page.mouse.click(195, 422);
    await expect(shell).toHaveAttribute('data-open', 'true', { timeout: 1200 });
  }).toPass({ timeout: 15000 });
  await expect(page.locator('.mobile-reader-shell__top')).toContainText('测试漫画源 A');
  await page.locator('.mobile-reader-shell__bottom button').filter({ hasText: '设置' }).click();
  await expect(page.locator('.source-appearance-dialog')).toBeVisible();
  await expect(page.locator('.source-appearance-dialog .mobile-reader-music')).toBeVisible();
});
