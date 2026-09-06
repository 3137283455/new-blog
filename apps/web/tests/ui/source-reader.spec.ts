import { test, expect } from '@playwright/test';
import { compare } from '../support/compare-pages';
import { coverSvg } from '../support/fixture-data.mjs';
for (const width of [1440, 390])
  for (const theme of ['boke-green', 'boke-night']) {
    test(`${width} ${theme} source reader UI with navigation and music`, async ({
      browser,
    }, info) => {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        serviceWorkers: 'block',
      });
      await context.addInitScript((t) => localStorage.setItem('theme', t), theme);
      await context.route('**/api/content-sources/media?**', (r) =>
        r.fulfill({ contentType: 'image/svg+xml', body: coverSvg }),
      );
      await context.route('**/api/visitors/count', (r) =>
        r.fulfill({ json: { success: true, data: { today: 1, total: 1 } } }),
      );
      const oldPage = await context.newPage(),
        newPage = await context.newPage();
      for (const [page, port] of [
        [oldPage, 4311],
        [newPage, 3111],
      ] as const) {
        await page.goto(
          `http://127.0.0.1:${port}/source/manga/fixture%3Aalpha/chapter/ep-42?id=book%2F42&title=Reader`,
        );
        await expect(page.locator('[data-source-reader]')).toHaveAttribute('data-mode', 'scroll');
        await expect(page.locator('[data-music-player]')).toHaveAttribute('data-ready', 'true');
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({
          content:
            '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
        });
      }
      await compare(oldPage, newPage, info);
      for (const page of [oldPage, newPage])
        await page.locator('[data-reader-mode="paged"]').click();
      await compare(oldPage, newPage, info, 'paged');
      await context.close();
    });
  }
test('reader shared widgets keep theme, command search and music controls', async ({ page }) => {
  await page.goto('http://127.0.0.1:3111/source/manga/fixture%3Aalpha/chapter/ep-42?id=book%2F42');
  await page.locator('.theme-menu summary').click();
  await page.locator('[data-theme-option="boke-night"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'boke-night');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#command-backdrop')).toBeVisible();
  await expect(page.locator('#command-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#command-backdrop')).toBeHidden();
  await page.locator('[data-music-panel-toggle]').click();
  await expect(page.locator('[data-music-panel]')).toBeVisible();
  await page.locator('[data-music-panel-close]').click();
  await expect(page.locator('[data-music-panel]')).toBeHidden();
});
