import { test, expect } from '@playwright/test';
import { compare } from '../support/compare-pages';
import { coverSvg } from '../support/fixture-data.mjs';
const path = '/manga/local-fixture/volume-1/chapter-1';
for (const width of [1440, 390])
  for (const mode of ['scroll', 'paged', 'double']) {
    test(`${width} local reader ${mode} UI`, async ({ browser }, info) => {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        serviceWorkers: 'block',
      });
      await context.addInitScript(
        (mode) => localStorage.setItem('comic_settings', JSON.stringify({ mode })),
        mode,
      );
      await context.route('**/uploads/fixture/*.svg', (r) =>
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
        await page.goto(`http://127.0.0.1:${port}${path}`);
        await expect(page.locator('[data-comic]')).toHaveAttribute('data-mode', mode);
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({
          content:
            '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
        });
        if (width < 760) {
          await expect(page.locator('[data-comic]')).toHaveClass(/controls/);
          await page.locator('[data-action="settings"]:visible').click();
          await page.locator('[data-settings] button[value="cancel"]').click();
        }
      }
      if (mode === 'scroll')
        for (const page of [oldPage, newPage]) {
          await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
          // Exercise the same complete scroll sequence on both pages. This also loads lazy images
          // and avoids comparing an in-flight initial scroll against a settled screenshot.
          await page.evaluate(() =>
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
          );
          await expect(page.locator('[data-page-label]')).toHaveText('3');
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
          await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
          await expect(page.locator('[data-page-label]')).toHaveText('1');
        }
      await compare(oldPage, newPage, info);
      await context.close();
    });
  }
test('local reader retains modes, RTL keys, settings, catalog and progress sync', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('boke_private_device_token', 'fixture-device'),
  );
  await page.route('**/uploads/fixture/*.svg', (r) =>
    r.fulfill({ contentType: 'image/svg+xml', body: coverSvg }),
  );
  await page.route('**/api/private/library', (r) =>
    r.fulfill({ json: { success: true, data: [] } }),
  );
  const saves: Array<Record<string, unknown>> = [];
  await page.route('**/api/private/manga/1/progress', (r) => {
    if (r.request().method() === 'GET')
      return r.fulfill({
        json: {
          success: true,
          data: {
            chapter_id: 11,
            page_index: 1,
            revision: 7,
            mode: 'paged',
            settings: { direction: 'rtl' },
          },
        },
      });
    saves.push(r.request().postDataJSON());
    return r.fulfill({ json: { success: true, data: { revision: 7 + saves.length } } });
  });
  await page.goto('http://127.0.0.1:3111' + path);
  await expect(page.locator('[data-comic]')).toHaveAttribute('data-mode', 'paged');
  await expect(page.locator('[data-page].current')).toHaveAttribute('data-index', '1');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-page].current')).toHaveAttribute('data-index', '2');
  await expect.poll(() => saves.length).toBeGreaterThan(0);
  expect(saves.at(-1)).toMatchObject({
    chapter_id: 11,
    volume_id: 1,
    page_index: 2,
    revision: 7,
    mode: 'paged',
  });
  await page.locator('[data-action="mode"]:visible').click();
  await expect(page.locator('[data-comic]')).toHaveAttribute('data-mode', 'double');
  await page.locator('[data-action="catalog"]:visible').click();
  await expect(page.locator('[data-catalog]')).toHaveClass(/open/);
  await expect(page.locator('[data-catalog] a').last()).toHaveAttribute(
    'href',
    '/manga/local-fixture/volume-2/chapter-2',
  );
  await page.locator('[data-close]').click();
  await page.locator('[data-action="settings"]:visible').click();
  await page.locator('[data-setting="mode"]').selectOption('scroll');
  await page.locator('[data-setting="numbers"]').check();
  await page.locator('[data-settings] [data-theme="paper"]').click();
  await expect(page.locator('[data-comic]')).toHaveAttribute('data-theme', 'paper');
  await expect(page.locator('[data-comic]')).toHaveClass(/numbers/);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('comic_settings') || '{}')),
  ).toMatchObject({ mode: 'scroll', theme: 'paper', numbers: true });
});
