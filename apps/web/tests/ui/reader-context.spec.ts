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
