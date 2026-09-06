import { test, expect } from '@playwright/test';
import { compare } from '../support/compare-pages';
for (const width of [1440, 390])
  for (const theme of ['boke-green', 'boke-night'])
    for (const kind of ['local', 'network']) {
      test(`${width} ${theme} ${kind} detail UI`, async ({ browser }, info) => {
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          serviceWorkers: 'block',
        });
        await context.addInitScript((t) => localStorage.setItem('theme', t), theme);
        await context.route('**/api/visitors/count', (r) =>
          r.fulfill({ json: { success: true, data: { today: 1, total: 1 } } }),
        );
        const oldPage = await context.newPage(),
          newPage = await context.newPage();
        for (const [page, port] of [
          [oldPage, 4311],
          [newPage, 3111],
        ] as const) {
          await page.goto(`http://127.0.0.1:${port}/manga/${kind}-fixture`);
          await expect(page.locator('.manga-detail-page h1')).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await page.addStyleTag({
            content:
              '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
          });
        }
        await compare(oldPage, newPage, info);
        await context.close();
      });
    }
test('local detail resumes exact chapter and expands its volume', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('boke_private_device_token', 'fixture-device'),
  );
  await page.route('**/api/private/library', (r) =>
    r.fulfill({ json: { success: true, data: [] } }),
  );
  await page.route('**/api/private/manga/1/progress', (r) =>
    r.fulfill({ json: { success: true, data: { chapter_id: 21, page_index: 1 } } }),
  );
  await page.goto('http://127.0.0.1:3111/manga/local-fixture');
  await expect(page.locator('[data-continue]')).toHaveAttribute(
    'href',
    '/manga/local-fixture/volume-2/chapter-2?page=2',
  );
  await expect(page.locator('[data-chapter-id="21"]')).toHaveClass('is-last-read');
  await expect(page.locator('[data-chapter-id="21"] [data-state]')).toHaveText('上次第 2 页');
  await expect(page.locator('[data-chapter-id="21"]')).toBeVisible();
});
