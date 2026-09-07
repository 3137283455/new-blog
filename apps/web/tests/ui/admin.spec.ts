import { test, expect, type BrowserContext } from '@playwright/test';
import { compare } from '../support/compare-pages';
import { fixtureResponse } from '../support/fixture-data.mjs';

for (const width of [1440, 390])
  for (const theme of ['boke-green', 'boke-night']) {
    test(`${width} ${theme} admin login preserves UI`, async ({ browser }, info) => {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        serviceWorkers: 'block',
      });
      await context.addInitScript((theme) => localStorage.setItem('theme', theme), theme);
      const oldPage = await context.newPage(),
        newPage = await context.newPage();
      const errors: string[] = [];
      newPage.on('pageerror', (error) => errors.push(error.message));
      for (const [page, port] of [
        [oldPage, 4311],
        [newPage, 3111],
      ] as const) {
        await page.goto(`http://127.0.0.1:${port}/admin`);
        await expect(page.locator('.admin-shell')).toHaveAttribute('data-status', '请先登录后台');
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({
          content:
            '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
        });
      }
      await compare(oldPage, newPage, info);
      expect(errors).toEqual([]);
      await context.close();
    });
  }

async function mockAdmin(context: BrowserContext) {
  await context.addInitScript(() => localStorage.setItem('boke_admin_token', 'fixture-admin'));
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    const data =
      path === '/api/auth/me'
        ? { id: 1, username: 'admin', nickname: '管理员', role: 'admin' }
        : path === '/api/admin/devices/register'
          ? { token: 'fixture-device' }
          : path === '/api/admin/manga'
            ? fixtureResponse(new URL('/api/manga', url))
            : path === '/api/admin/search-sources'
              ? { sources: [], defaults: {} }
              : path === '/api/admin/venera-sources'
                ? { repositories: [], sources: [] }
                : path.startsWith('/api/admin/dashboard/') || path === '/api/admin/media/explorer'
                  ? {}
                  : path.startsWith('/api/admin/') ||
                      ['/api/categories', '/api/tags'].includes(path)
                    ? []
                    : fixtureResponse(url);
    await route.fulfill({ json: { success: true, data } });
  });
}
for (const width of [1440, 390])
  test(`${width} admin authenticated domains retain UI and navigation`, async ({
    browser,
  }, info) => {
    test.setTimeout(120000);
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      serviceWorkers: 'block',
    });
    await mockAdmin(context);
    const oldPage = await context.newPage(),
      newPage = await context.newPage();
    const errors: string[] = [];
    newPage.on('pageerror', (error) => errors.push(error.message));
    for (const [page, port] of [
      [oldPage, 4311],
      [newPage, 3111],
    ] as const) {
      await page.goto(`http://127.0.0.1:${port}/admin`);
      await expect(page.locator('.admin-shell')).toHaveAttribute('data-status', '已连接后端 API');
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({
        content:
          '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
      });
    }
    await compare(oldPage, newPage, info, 'dashboard');
    for (const panel of [
      'articles',
      'content-center',
      'series',
      'books',
      'navigation',
      'bangumi',
      'manga',
      'search-sources',
      'albums',
      'music',
      'media',
      'fonts',
      'settings',
      'personal',
      'appearance',
      'taxonomy',
      'comments',
      'backup',
      'plugins',
    ]) {
      for (const page of [oldPage, newPage]) {
        await page
          .locator(`[data-panel-tab="${panel}"], [data-panel="${panel}"]`)
          .first()
          .evaluate((button: HTMLButtonElement) => button.click());
        await expect(page.locator(`#${panel}-panel`)).toBeVisible();
        if (panel === 'manga') await expect(page.locator('#manga-list article')).toHaveCount(2);
        if (panel === 'search-sources')
          await expect(page.locator('#venera-repository-list')).toContainText('还没有同步');
      }
      await compare(oldPage, newPage, info, panel);
    }
    expect(errors).toEqual([]);
    await context.close();
  });

test('existing manga source import/export controls include Venera and preserve their ownership', async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await mockAdmin(context);
  const venera = { schema: 'boke-venera-repositories', version: 1, config: { repositories: [] } };
  const config = {
    version: 1,
    defaults: { manga: 'fixture', book: 'novel' },
    sources: [
      { id: 'fixture', label: '漫画接口源', kinds: ['manga'], enabled: true },
      { id: 'novel', label: '小说接口源', kinds: ['book'], enabled: true },
    ],
  };
  await context.route('**/api/admin/search-sources', (route) =>
    route.fulfill({ json: { success: true, data: config } }),
  );
  await context.route('**/api/admin/venera-sources/export', (route) =>
    route.fulfill({ json: venera }),
  );
  const imports: unknown[] = [];
  await context.route('**/api/admin/venera-sources/import', (route) => {
    imports.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true, data: { repositories: [], sources: [] } } });
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3111/admin#manga-sources');
  await expect(page.locator('#search-sources-panel')).toBeVisible();
  await expect(page.locator('#venera-repository-list')).toContainText('还没有同步');
  await expect(page.locator('.admin-sidebar [data-panel="search-sources"]')).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#search-source-export-all').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(backup.venera).toEqual(venera);
  expect(backup.config.sources.map((source: { id: string }) => source.id)).toEqual(['fixture']);
  expect(backup.config.defaults).toEqual({ manga: 'fixture' });
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('#search-source-import').setInputFiles({
    name: 'venera.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(venera)),
  });
  await expect.poll(() => imports.length).toBe(1);
  expect(imports[0]).toEqual({ file: venera, mode: 'merge' });
  await expect(page.locator('#content-search-source-message')).toContainText('导入完成');
  await context.close();
});

test('admin login, manga settings save and logout execute once after React remount', async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await mockAdmin(context);
  await context.addInitScript(() => localStorage.removeItem('boke_admin_token'));
  const logins: unknown[] = [],
    saves: unknown[] = [];
  await context.route('**/api/auth/login', (route) => {
    logins.push(route.request().postDataJSON());
    return route.fulfill({
      json: { success: true, data: { token: 'fixture-admin', user: { username: 'admin' } } },
    });
  });
  await context.route('**/api/admin/manga/1', (route) => {
    saves.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true, data: {} } });
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:3111/admin');
  await expect(page.locator('.admin-shell')).toHaveAttribute('data-status', '请先登录后台');
  await page.locator('#login-form [name="username"]').fill('admin');
  await page.locator('#login-form [name="password"]').fill('fixture-password');
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator('.admin-shell')).toHaveAttribute('data-status', '已登录：admin');
  expect(logins).toEqual([{ username: 'admin', password: 'fixture-password' }]);
  expect(await page.evaluate(() => localStorage.getItem('boke_admin_token'))).toBe('fixture-admin');
  await page.locator('.admin-sidebar [data-panel="articles"]').click();
  await page.locator('#articles-panel [data-panel-tab="manga"]').click();
  await page.locator('[data-manga-settings="1"]').click();
  const dialog = page.locator('#manga-settings-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('[name="status"]').selectOption('finished');
  await dialog.locator('[name="sort_order"]').fill('7');
  await dialog.locator('[name="is_active"]').check();
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).not.toBeVisible();
  expect(saves).toEqual([{ status: 'finished', sort_order: 7, is_active: true }]);
  await page.locator('.admin-account-menu summary').click();
  await page.locator('#logout-admin').click();
  await expect(page.locator('#login-panel')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('boke_admin_token'))).toBeNull();
  expect(errors).toEqual([]);
  await context.close();
});
