import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { fixtureResponse, sources, results, coverSvg } from '../support/fixture-data.mjs';

const oldOrigin = 'http://127.0.0.1:4311';
const newOrigin = 'http://127.0.0.1:3111';

async function prepare(page: Page, theme = 'boke-green', state = 'results') {
  await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/media'))
      return route.fulfill({ contentType: 'image/svg+xml', body: coverSvg });
    if (state === 'error' && /\/(search|explore)$/.test(url.pathname))
      return route.fulfill({
        status: 502,
        json: { success: false, message: '测试：来源暂时不可用' },
      });
    const data = fixtureResponse(url);
    if (state === 'empty' && data && typeof data === 'object' && 'items' in data) data.items = [];
    return route.fulfill({ json: { success: true, data } });
  });
}

async function settle(page: Page, path: string) {
  await expect(page.locator('[data-manga-source-summary]')).toContainText('2 个来源');
  if (path !== '/manga/search')
    await expect(page.locator('[data-manga-state]')).not.toContainText(/正在/);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((image) => image.decode().catch(() => {})));
  });
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  });
}

async function compare(oldPage: Page, newPage: Page, info: TestInfo) {
  const baseline = await oldPage.screenshot({ fullPage: true, animations: 'disabled' });
  const candidate = await newPage.screenshot({ fullPage: true, animations: 'disabled' });
  await writeFile(info.outputPath('legacy.png'), baseline);
  await writeFile(info.outputPath('next.png'), candidate);
  await info.attach('legacy', { body: baseline, contentType: 'image/png' });
  await info.attach('next', { body: candidate, contentType: 'image/png' });
  const oldImage = PNG.sync.read(baseline);
  const newImage = PNG.sync.read(candidate);
  expect(
    { width: newImage.width, height: newImage.height },
    'page dimensions must be unchanged',
  ).toEqual({ width: oldImage.width, height: oldImage.height });
  const diff = new PNG({ width: oldImage.width, height: oldImage.height });
  const changed = pixelmatch(
    oldImage.data,
    newImage.data,
    diff.data,
    oldImage.width,
    oldImage.height,
    { threshold: 0.1 },
  );
  const ratio = changed / (oldImage.width * oldImage.height);
  await writeFile(info.outputPath('diff.png'), PNG.sync.write(diff));
  await info.attach('diff', { body: PNG.sync.write(diff), contentType: 'image/png' });
  await writeFile(
    info.outputPath('comparison.json'),
    JSON.stringify(
      { changedPixels: changed, totalPixels: oldImage.width * oldImage.height, ratio },
      null,
      2,
    ),
  );
  expect(
    ratio,
    `${changed} visually changed pixels; inspect legacy/next/diff attachments`,
  ).toBeLessThanOrEqual(0.001);
}

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  for (const scenario of [
    { name: 'home', path: '/manga' },
    { name: 'search-idle', path: '/manga/search' },
    { name: 'search-results', path: '/manga/search?q=星海&source=fixture%3Aalpha' },
    { name: 'latest', path: '/manga/latest' },
    { name: 'search-empty', path: '/manga/search?q=不存在', state: 'empty' },
    { name: 'search-error', path: '/manga/search?q=失败', state: 'error' },
    { name: 'source-dialog', path: '/manga/search', dialog: true },
    { name: 'night', path: '/manga/search', theme: 'boke-night' },
    { name: 'punk', path: '/manga/search', theme: 'boke-punk' },
  ]) {
    test(`${viewport.width} ${scenario.name} preserves legacy UI`, async ({ browser }, info) => {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        serviceWorkers: 'block',
      });
      const oldPage = await context.newPage();
      const newPage = await context.newPage();
      const errors: string[] = [];
      newPage.on('pageerror', (error) => errors.push(error.message));
      await prepare(oldPage, scenario.theme, scenario.state);
      await prepare(newPage, scenario.theme, scenario.state);
      await oldPage.goto(`${oldOrigin}${scenario.path}`);
      await newPage.goto(`${newOrigin}${scenario.path}`);
      await settle(oldPage, scenario.path);
      await settle(newPage, scenario.path);
      if (scenario.dialog) {
        await oldPage.locator('[data-manga-source-open]').click();
        await newPage.locator('[data-manga-source-open]').click();
      }
      expect(errors).toEqual([]);
      await compare(oldPage, newPage, info);
      await context.close();
    });
  }
}

test('source modal, search, URL and existing detail links keep working', async ({ page }) => {
  await prepare(page);
  await page.goto(`${newOrigin}/manga/search`);
  await settle(page, '/manga/search');
  await page.locator('[data-manga-source-open]').click();
  await expect(page.locator('dialog')).toBeVisible();
  await page.locator('[data-manga-source-filter]').fill('B');
  await expect(page.locator('[data-source-option="fixture:alpha"]')).toHaveCount(0);
  await page.locator('[data-source-option="fixture:beta"]').click();
  await expect(page.locator('dialog')).not.toBeVisible();
  await expect(page.locator('[data-manga-selected-source-label]')).toHaveText('测试漫画源 B');
  await page.locator('[data-manga-query]').fill('海贼王');
  await page.locator('[data-manga-query]').press('Enter');
  await expect(page.locator('.manga-result-card')).toHaveCount(7);
  await expect(page).toHaveURL(/source=fixture%3Abeta/);
  await expect(page.locator('.manga-result-cover').first()).toHaveAttribute(
    'href',
    '/source/manga/fixture%3Aalpha/fixture%2F0',
  );
  await page.locator('[data-manga-source-open]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).not.toBeVisible();
});

test('an older slow search cannot overwrite the latest search', async ({ page }) => {
  await prepare(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/content-sources/search?**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q') || '';
    if (query === '旧查询') await gate;
    await route
      .fulfill({ json: { success: true, data: { items: results(query), source: sources[0] } } })
      .catch(() => {});
  });
  await page.goto(`${newOrigin}/manga/search`);
  await settle(page, '/manga/search');
  const input = page.locator('[data-manga-query]');
  await input.fill('旧查询');
  const requested = page.waitForRequest((request) =>
    request.url().includes(encodeURIComponent('旧查询')),
  );
  await input.press('Enter');
  await requested;
  await input.fill('新查询');
  await input.press('Enter');
  await expect(page.locator('[data-search-title]')).toHaveText('“新查询”的搜索结果');
  release();
  await expect(page.locator('.manga-result-card h3').first()).toHaveText('新查询 1');
  await expect(page).toHaveURL(/q=%E6%96%B0%E6%9F%A5%E8%AF%A2/);
});

test('unmigrated pages stay on the same origin and retain their original UI', async ({ page }) => {
  await prepare(page);
  await page.goto(`${newOrigin}/manga/search`);
  await page.getByRole('link', { name: '排行', exact: true }).click();
  await expect(page).toHaveURL(`${newOrigin}/manga/rank`);
  await expect(page.locator('h1')).toHaveText('排行榜正在准备中。');
  await page.getByRole('link', { name: '发现', exact: true }).click();
  await expect(page).toHaveURL(`${newOrigin}/manga`);
  await expect(page.locator('.manga-home')).toBeVisible();
  await page.locator('[data-manga-query]').fill('回到新版');
  await page.locator('[data-manga-query]').press('Enter');
  await expect(page).toHaveURL(/\/manga\/search\?q=/);
  await expect(page.locator('[data-search-title]')).toHaveText('“回到新版”的搜索结果');
});

test('discovery loads once per selection and unsupported sources keep their existing empty state', async ({
  page,
}) => {
  await prepare(page);
  let discoveries = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/content-sources/explore?')) discoveries++;
  });
  await page.goto(`${newOrigin}/manga/latest`);
  await settle(page, '/manga/latest');
  expect(discoveries).toBe(1);
  await page.locator('[data-manga-source-open]').click();
  await page.locator('[data-source-option="fixture:beta"]').click();
  await expect(page.locator('.manga-result-empty')).toContainText('从搜索开始');
  expect(discoveries).toBe(1);
});

test('API and image proxy preserve query parameters, cookies and media responses', async ({
  request,
}) => {
  const echo = await request.get(`${newOrigin}/api/__test__/echo?value=a%2Fb%3Fc%3D1`, {
    headers: { Cookie: 'fixture_session=ui-test-only' },
  });
  expect(await echo.json()).toEqual({ cookie: 'fixture_session=ui-test-only', query: 'a/b?c=1' });
  expect(
    echo.headersArray().filter((header) => header.name.toLowerCase() === 'set-cookie'),
  ).toHaveLength(2);
  const response = await request.get(
    `${newOrigin}/api/content-sources/search?kind=manga&q=代理测试`,
  );
  expect(response.ok()).toBe(true);
  expect((await response.json()).data.items[0].title).toBe('代理测试 1');
  const media = await request.get(
    `${newOrigin}/api/content-sources/media?kind=manga&source=fixture%3Aalpha&url=https%3A%2F%2Ffixture.invalid%2Fcover.svg`,
  );
  expect(media.headers()['content-type']).toContain('image/svg+xml');
  expect(await media.text()).toBe(coverSvg);
});
