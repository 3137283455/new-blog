import { test, expect, type BrowserContext } from '@playwright/test';
import { compare } from '../support/compare-pages';
const article = {
  id: 1,
  title: '写作台样例',
  slug: 'writer-fixture',
  content: '## 第一节\n\n这是用来验证编辑和预览的正文。',
  status: 'draft',
  visibility: 'public',
  updated_at: '2026-09-07',
  tags: [],
};
async function mock(context: BrowserContext) {
  await context.addInitScript(() => localStorage.setItem('boke_admin_token', 'fixture-admin'));
  await context.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === '/api/admin/articles/1'
        ? article
        : path === '/api/admin/articles'
          ? [article]
          : path === '/api/admin/markdown/preview'
            ? { html: '<h2>第一节</h2><p>这是用来验证编辑和预览的正文。</p>' }
            : [];
    return route.fulfill({ json: { success: true, data } });
  });
}
for (const width of [1440, 390])
  test(`${width} writer editor, preview and side panels preserve UI`, async ({ browser }, info) => {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      serviceWorkers: 'block',
    });
    await mock(context);
    const oldPage = await context.newPage(),
      newPage = await context.newPage();
    const errors: string[] = [];
    newPage.on('pageerror', (error) => errors.push(error.message));
    for (const [page, port] of [
      [oldPage, 4311],
      [newPage, 3111],
    ] as const) {
      await page.goto(`http://127.0.0.1:${port}/admin/write?id=1`);
      await expect(page.locator('#save-status')).toHaveText('已载入文章');
      await expect(page.locator('#title')).toHaveValue(article.title);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({
        content:
          '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
      });
    }
    await compare(oldPage, newPage, info, 'editor');
    for (const page of [oldPage, newPage]) {
      await page.locator('#toggle-preview').click();
      await expect(page.locator('#preview-panel h2')).toHaveText('第一节');
    }
    await compare(oldPage, newPage, info, 'preview');
    if (width < 760)
      for (const panel of ['articles', 'settings']) {
        for (const page of [oldPage, newPage])
          await page.locator(`.writer-mobile-nav [data-mobile-panel="${panel}"]`).click();
        await compare(oldPage, newPage, info, panel);
      }
    expect(errors).toEqual([]);
    await context.close();
  });
test('writer draft save preserves payload and local autosave', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await mock(context);
  const saves: Array<Record<string, unknown>> = [];
  await context.route('**/api/admin/articles/1', (route) => {
    if (route.request().method() === 'PUT') saves.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true, data: article } });
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3111/admin/write?id=1');
  await expect(page.locator('#save-status')).toHaveText('已载入文章');
  await page.locator('#title').fill('修改后的标题');
  await page.locator('#content').fill('修改后的正文');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const draft = localStorage.getItem('boke_writer_autosave_1');
          return draft ? JSON.parse(draft).title : '';
        }),
      { timeout: 10000 },
    )
    .toBe('修改后的标题');
  await page.locator('#save-draft').click();
  await expect(page.locator('#save-status')).toHaveText('已保存草稿');
  expect(saves).toHaveLength(1);
  expect(saves[0]).toMatchObject({
    title: '修改后的标题',
    content: '修改后的正文',
    status: 'draft',
    visibility: 'public',
  });
  expect(await page.evaluate(() => localStorage.getItem('boke_writer_autosave_1'))).toBeNull();
  await context.close();
});

test('writer recovers an unsaved draft after reloading before the autosave delay', async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await mock(context);
  const page = await context.newPage();
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
  await page.goto('http://127.0.0.1:3111/admin/write?id=1');
  await expect(page.locator('#save-status')).toHaveText('已载入文章');
  await page.locator('#title').fill('立即刷新前的标题');
  await page.locator('#content').fill('不能因为尚未满五秒而丢失的正文');
  await page.reload();
  await expect(page.locator('#title')).toHaveValue('立即刷新前的标题');
  await expect(page.locator('#content')).toHaveValue('不能因为尚未满五秒而丢失的正文');
  expect(dialogs.some((message) => message.includes('本地临时稿'))).toBe(true);
  await context.close();
});
