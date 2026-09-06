import { test, expect } from '@playwright/test';
import { compare } from '../support/compare-pages';
const rows = [
  {
    kind: 'manga',
    id: 1,
    title: '本地漫画样例',
    chapter_title: '初见',
    section_title: '第一卷',
    progress: 0.5,
    href: '/manga/local-fixture/volume-1/chapter-1',
  },
  {
    kind: 'book',
    id: 2,
    title: '小说样例',
    chapter_title: '序章',
    progress: 0.2,
    href: '/books/book-1/volume-1/chapter-1',
  },
];
for (const width of [1440, 390])
  for (const authorized of [false, true]) {
    test(`${width} reading center ${authorized ? 'authorized' : 'unauthorized'} UI`, async ({
      browser,
    }, info) => {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        serviceWorkers: 'block',
      });
      if (authorized)
        await context.addInitScript(() =>
          localStorage.setItem('boke_private_device_token', 'fixture-device'),
        );
      await context.route('**/api/private/library', (r) =>
        r.fulfill({ json: { success: true, data: [] } }),
      );
      await context.route('**/api/private/reading-center', (r) =>
        r.fulfill({ json: { success: true, data: rows } }),
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
        await page.clock.setFixedTime(new Date('2026-09-07T00:00:00+08:00'));
        await page.goto(`http://127.0.0.1:${port}/reading`);
        await expect(page.locator('[data-summary]')).toHaveText(
          authorized ? '2 条阅读记录' : '需要私人设备授权',
        );
        await expect(page.locator('#visitor-today')).toHaveText('1');
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({
          content:
            '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
        });
      }
      await compare(oldPage, newPage, info);
      if (authorized) {
        await newPage.locator('[data-kind="manga"]').click();
        await expect(newPage.locator('.reading-item')).toHaveCount(1);
        await expect(newPage.locator('.reading-item h2')).toHaveText('本地漫画样例');
      }
      await context.close();
    });
  }
