import { test, expect } from '@playwright/test';
import { compare } from '../support/compare-pages';

for (const width of [1440, 390])
  for (const theme of ['boke-green', 'boke-night']) {
    test(`${width} ${theme} book library and source explorer preserve UI`, async ({ browser }, info) => {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        serviceWorkers: 'block',
      });
      await context.addInitScript((value) => localStorage.setItem('theme', value), theme);
      const oldPage = await context.newPage();
      const newPage = await context.newPage();
      for (const [page, port] of [[oldPage, 4311], [newPage, 3111]] as const) {
        await page.goto(`http://127.0.0.1:${port}/books`);
        await expect(page.locator('.library-page h1')).toHaveText('书库');
        await expect(page.locator('.source-explorer h2')).toHaveText('从源中搜索小说');
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({
          content:
            '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
        });
      }
      await compare(oldPage, newPage, info);
      for (const page of [oldPage, newPage]) {
        await page.locator('[data-library-view="list"]').click();
        await page.locator('[data-library-search]').fill('站外');
      }
      await compare(oldPage, newPage, info, 'filtered-list');
      await context.close();
    });
  }

test('book source explorer searches and keeps opaque source links', async ({ page }) => {
  await page.goto('http://127.0.0.1:3111/books');
  await expect(page.locator('[data-source-select] option')).toHaveCount(3);
  await page.locator('[data-source-query]').fill('星海');
  await page.locator('[data-source-form]').evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await expect(page.locator('.source-result')).toHaveCount(7);
  await expect(page.locator('.source-result').first()).toHaveAttribute(
    'href',
    '/source/book/fixture%3Aalpha/fixture%2F0',
  );
});
