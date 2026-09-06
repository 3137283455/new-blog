import { test, expect } from '@playwright/test';
import { compare } from '../support/compare-pages';

const path = '/source/manga/fixture%3Aalpha/fixture-0';
for (const width of [1440, 390])
  for (const theme of ['boke-green', 'boke-night']) {
    test(`${width} ${theme} source detail preserves UI`, async ({ browser }, info) => {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        serviceWorkers: 'block',
      });
      await context.addInitScript((value) => localStorage.setItem('theme', value), theme);
      const oldPage = await context.newPage(),
        newPage = await context.newPage();
      await oldPage.goto('http://127.0.0.1:4311' + path);
      await newPage.goto('http://127.0.0.1:3111' + path);
      for (const page of [oldPage, newPage]) {
        await expect(page.locator('.source-detail-copy h1')).toHaveText('星海漫游');
        await expect(page.locator('[data-manga-shelf]')).toHaveText('加入书架');
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

test('source detail preserves shelf/favorite state and opaque chapter URLs', async ({ page }) => {
  await page.goto('http://127.0.0.1:3111/source/manga/fixture%3Aalpha/fixture%2F0');
  await page.locator('[data-manga-shelf]').click();
  await expect(page.locator('[data-manga-shelf]')).toHaveText('已在书架');
  await page.locator('[data-manga-favorite]').click();
  await expect(page.locator('[data-manga-favorite]')).toHaveText('已收藏');
  await page.reload();
  await expect(page.locator('[data-manga-favorite]')).toHaveText('已收藏');
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('boke_manga_collections') || '[]'),
  );
  expect(stored[0]).toMatchObject({
    source: 'fixture:alpha',
    external_id: 'fixture/0',
    in_shelf: true,
    is_favorite: true,
  });
  await expect(page.locator('.source-primary')).toHaveAttribute(
    'href',
    '/source/manga/fixture%3Aalpha/chapter/ep-42?id=fixture%2F0&title=%E7%AC%AC%E4%B8%80%E7%AB%A0%EF%BC%9A%E5%90%AF%E7%A8%8B',
  );
  await page.locator('[data-manga-favorite]').click();
  await page.locator('[data-manga-shelf]').click();
  await expect(page.locator('[data-manga-shelf]')).toHaveText('加入书架');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('boke_manga_collections') || '[]')),
  ).toEqual([]);
});
