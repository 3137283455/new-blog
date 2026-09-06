import { test, expect } from '@playwright/test';
import { compare } from '../support/compare-pages';

const collection = {
  source: 'fixture:alpha',
  external_id: 'fixture/0',
  title: '远程收藏样例',
  in_shelf: true,
  is_favorite: true,
  status: 'planned',
  updated_at: '2026-01-01',
};
for (const width of [1440, 390])
  for (const theme of ['boke-green', 'boke-night']) {
    for (const route of ['library', 'rank'])
      test(`${width} ${theme} manga ${route} UI`, async ({ browser }, info) => {
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          serviceWorkers: 'block',
        });
        await context.addInitScript(
          ({ theme, collection }) => {
            localStorage.setItem('theme', theme);
            localStorage.setItem('boke_manga_collections', JSON.stringify([collection]));
          },
          { theme, collection },
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
          await page.goto(`http://127.0.0.1:${port}/manga/${route}`);
          if (route === 'library')
            await expect(page.locator('[data-manga-stat-total]')).toHaveText('3');
          await page.evaluate(() => document.fonts.ready);
          await page.addStyleTag({
            content:
              '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
          });
        }
        await compare(oldPage, newPage, info);
        if (route === 'library') {
          for (const page of [oldPage, newPage])
            await page.locator('[data-manga-view="list"]').click();
          await compare(oldPage, newPage, info, 'list');
        }
        await context.close();
      });
  }

test('library filters local and collected comics and persists view', async ({ page }) => {
  await page.addInitScript(
    (c) => localStorage.setItem('boke_manga_collections', JSON.stringify([c])),
    collection,
  );
  await page.goto('http://127.0.0.1:3111/manga/library');
  await expect(page.locator('[data-manga-count]')).toHaveText('3 部');
  await page.locator('[data-manga-type="local"]').click();
  await expect(page.locator('[data-manga-card]:visible')).toHaveCount(1);
  await page.locator('[data-manga-type="network"]').click();
  await expect(page.locator('[data-manga-card]:visible')).toHaveCount(2);
  await page.locator('[data-manga-status-filter="planned"]').click();
  await expect(page.locator('[data-manga-card]:visible')).toHaveCount(1);
  await expect(page.locator('[data-manga-card]:visible h3')).toHaveText('远程收藏样例');
  await page.locator('[data-manga-search]').fill('不存在');
  await expect(page.locator('[data-manga-empty]')).toBeVisible();
  await page.locator('[data-manga-search]').fill('');
  await page.locator('[data-manga-view="list"]').click();
  await page.reload();
  await expect(page.locator('[data-manga-shelf]')).toHaveAttribute('data-view', 'list');
  await page.keyboard.press('/');
  await expect(page.locator('[data-manga-search]')).toBeFocused();
});
