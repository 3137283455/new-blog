import { test, expect } from '@playwright/test';

test('offline save confirms cached assets and the downloaded reader works without network', async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  await context.addInitScript(() =>
    localStorage.setItem('boke_private_device_token', 'fixture-device'),
  );
  await context.route('**/api/private/library', (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
  const href = '/manga/local-fixture/volume-1/chapter-1';
  await context.route('**/api/private/reading-center', (route) =>
    route.fulfill({
      json: { success: true, data: [{ kind: 'manga', id: 1, title: '本地漫画样例', href }] },
    }),
  );
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3111/reading');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const button = page.locator('[data-offline]');
  await button.click();
  await expect(button).toHaveText('已保存', { timeout: 45000 });
  expect(
    await page.evaluate(async (href) => {
      const cache = await caches.open('boke-reading-v1');
      return {
        document: !!(await cache.match(href)),
        images: (await cache.keys()).filter((request) => request.url.includes('/uploads/fixture/'))
          .length,
      };
    }, href),
  ).toEqual({ document: true, images: 3 });
  await context.setOffline(true);
  await page.goto('http://127.0.0.1:3111' + href);
  await expect(page.locator('[data-comic]')).toHaveAttribute('data-mode', 'scroll');
  await expect
    .poll(() =>
      page
        .locator('[data-page] img')
        .first()
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.locator('[data-action="mode"]:visible').click();
  await expect(page.locator('[data-comic]')).toHaveAttribute('data-mode', 'paged');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-page].current')).toHaveAttribute('data-index', '1');
  await context.close();
});
