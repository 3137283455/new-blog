import { test, expect } from '@playwright/test';

for (const origin of ['http://127.0.0.1:4311', 'http://127.0.0.1:3111']) {
  for (const width of [1440, 390]) {
    test(`reader ${origin} ${width} forwards image context and keeps both reading modes`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      const requests: URL[] = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname === '/api/content-sources/media') requests.push(url);
      });
      const response = await page.goto(
        `${origin}/source/manga/fixture%3Aalpha/chapter/ep-42?id=book%2F42&title=Reader`,
      );
      expect(response?.status()).toBe(200);
      const stage = page.locator('[data-source-reader="manga"]');
      await expect(stage).toHaveAttribute('data-mode', 'scroll');
      const images = stage.locator('img');
      await expect(images).toHaveCount(2);
      await expect.poll(() => requests.length).toBe(2);
      for (const request of requests) {
        expect(request.origin).toBe(origin);
        expect(request.searchParams.get('source')).toBe('fixture:alpha');
        expect(request.searchParams.get('purpose')).toBe('page');
        expect(request.searchParams.get('comic_id')).toBe('book/42');
        expect(request.searchParams.get('chapter_id')).toBe('ep-42');
      }
      await page.locator('[data-reader-mode="paged"]').click();
      await expect(stage).toHaveAttribute('data-mode', 'paged');
      await expect(page.locator('[data-reader-figure].is-current')).toHaveAttribute(
        'data-index',
        '0',
      );
      await page.locator('[data-reader-next]').click();
      await expect(page.locator('[data-reader-figure].is-current')).toHaveAttribute(
        'data-index',
        '1',
      );
      await expect(page).toHaveURL(/page=2/);
      await expect(page.locator('[data-reader-next]')).toBeDisabled();
      await page.locator('[data-reader-mode="scroll"]').click();
      await expect(stage).toHaveAttribute('data-mode', 'scroll');
      await expect(images.first()).toBeVisible();
      await expect(images.last()).toBeVisible();
    });
  }
  test(`reader ${origin} displays chapter failure without redirecting elsewhere`, async ({
    page,
  }) => {
    await page.goto(`${origin}/source/manga/fixture%3Aalpha/chapter/failed?id=book%2F42`);
    await expect(page.locator('.source-reader-error')).toContainText('测试：本章暂时不可用');
    await expect(page).toHaveURL(/chapter\/failed/);
    await expect(page.locator('[data-reader-figure]')).toHaveCount(0);
    await expect(page.locator('.source-reader-error a')).toHaveAttribute(
      'href',
      '/source/manga/fixture%3Aalpha/book%2F42',
    );
  });
}

test('reader gives the first page priority and starts six native preload requests', async ({
  page,
}) => {
  const started: string[] = [];
  const releases = new Map<string, () => void>();
  await page.route('**/api/content-sources/media?**', async (route) => {
    const target = new URL(route.request().url()).searchParams.get('url') || '';
    const name = target.match(/page-(\d+)\.svg$/)?.[1] || target;
    started.push(name);
    await new Promise<void>((resolve) => releases.set(name, resolve));
    await route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360" />',
    });
  });

  await page.goto(
    'http://127.0.0.1:3111/source/manga/fixture%3Aalpha/chapter/sequence?id=book%2F42',
    { waitUntil: 'domcontentloaded' },
  );
  await expect.poll(() => started.length).toBeGreaterThanOrEqual(6);
  expect(new Set(started.slice(0, 6))).toEqual(new Set(['01', '02', '03', '04', '05', '06']));

  const images = page.locator('[data-reader-figure] img');
  await expect(images.nth(0)).toHaveAttribute('loading', 'eager');
  await expect(images.nth(0)).toHaveAttribute('fetchpriority', 'high');
  await expect(images.nth(5)).toHaveAttribute('loading', 'eager');
  await expect(images.nth(6)).toHaveAttribute('loading', 'lazy');

  releases.get('02')?.();
  await expect(page.locator('[data-reader-figure][data-index="1"]')).toHaveAttribute(
    'data-load-state',
    'ready',
  );
  const boxes = await page
    .locator('[data-reader-figure]')
    .evaluateAll((nodes) => nodes.slice(0, 2).map((node) => node.getBoundingClientRect().top));
  expect(boxes[1] - boxes[0]).toBeGreaterThan(300);

  for (const release of releases.values()) release();
});
