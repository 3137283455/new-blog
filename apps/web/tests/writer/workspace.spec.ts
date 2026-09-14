import {test,expect, type Page} from '@playwright/test';
const article = {id:1,title:'写作是一场缓慢的整理',slug:'writing',content:'## 第一节\n\n记录那些值得留下的想法。',status:'draft',visibility:'private',updated_at:'2026-09-14',tags:[],view_count:12,excerpt:'把零散的灵感整理成文字。'};
async function mock(page: Page) {
  await page.addInitScript(() => { if (window === window.top) localStorage.setItem('boke_admin_token','fixture'); });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === '/api/admin/articles/1' ? article : path === '/api/admin/articles' ? [article] : path === '/api/admin/markdown/preview' ? {html:'<h2>第一节</h2><p>记录那些值得留下的想法。</p>'} : [];
    return route.fulfill({json:{success:true,data,pagination:{total:1}}});
  });
}
for (const width of [1440,390]) test(width + ' workspace, editor and import', async ({page}, info) => {
  await page.setViewportSize({width,height:900}); await mock(page);
  const errors: string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/admin/write');
  await expect(page.getByRole('heading',{name:'写作台'})).toBeVisible();
  await expect(page.locator('.writing-row')).toHaveCount(1);
  await expect(page.locator('#content')).toHaveCount(0);
  await page.screenshot({path:info.outputPath('workspace.png'),fullPage:true});
  await page.getByRole('button',{name:'网页导入'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.route('**/api/admin/web-import/preview',route=>route.fulfill({json:{success:true,data:{preview_id:'preview',title:'导入示例',html:'<h2>导入正文</h2><p>网页内容已完成提取。</p>',characters:1200,source:{final_url:'https://example.com/post',author:'作者'},images:[{id:'1',url:'https://example.com/cover.jpg',alt:'示例插图'}],duplicates:[]}}}));
  await page.getByLabel('文章链接').fill('https://example.com/post');
  await page.getByRole('button',{name:'提取正文'}).click();
  await expect(page.getByLabel('文章标题')).toHaveValue('导入示例');
  await page.screenshot({path:info.outputPath('import.png'),fullPage:true});
  await page.getByLabel('关闭网页导入').click();
  await page.locator('.writing-row-title a').click();
  await expect(page).toHaveURL(/\/editor\?id=1/);
  await expect(page.locator('#title')).toHaveValue(article.title);
  await expect(page.locator('#content')).toBeVisible();
  await expect(page.locator('.writer-left')).toHaveCount(0);
  await page.screenshot({path:info.outputPath('editor.png'),fullPage:true});
  if(width<760) await page.locator('[data-mobile-panel="settings"]').click();
  else await page.locator('#toggle-right').click();
  await expect(page.locator('#category')).toBeVisible();
  await expect(page.locator('#music-track')).toBeVisible();
  await page.screenshot({path:info.outputPath('settings.png'),fullPage:true});
  await page.locator('.writer-right [data-mobile-close]').click();
  await expect(page.locator('.writer-right')).toBeHidden();
  await page.locator('#content').fill('新的草稿正文');
  let saved:any; await page.route('**/api/admin/articles/1',route=>{saved=route.request().postDataJSON();return route.fulfill({json:{success:true,data:article}});});
  await page.locator('#save-draft').click(); await expect(page.locator('#save-status')).toHaveText('已保存草稿');
  expect(saved.content).toBe('新的草稿正文'); expect(saved.status).toBe('draft');
  await page.locator('#toggle-preview').click(); await expect(page.locator('#preview-panel')).toBeVisible();
  const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);expect(noOverflow).toBe(true);
  expect(errors).toEqual([]);
});
test('old article URL redirects to editor',async({page})=>{await mock(page);await page.goto('/admin/write?id=1');await expect(page).toHaveURL(/\/editor\?id=1/);await expect(page.locator('#title')).toHaveValue(article.title);});
