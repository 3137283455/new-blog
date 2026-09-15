import {test, expect} from '@playwright/test';
import {fixtureResponse} from '../support/fixture-data.mjs';
test.use({baseURL:'http://127.0.0.1:3111'});
for(const width of [1440,390]) {
  test(width+' reader controls remain in viewport', async({page}, info)=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/books/ui-fixture/volume/chapter');
    await expect(page.locator('.reading-prose')).toBeVisible();
    await page.evaluate(()=>scrollTo(0,1300));
    if(width<760) {
      await page.locator('.reading-workspace').click({position:{x:width/2,y:450}});
      await page.locator('.mobile-reader-shell__bottom button').filter({hasText:'设置'}).click();
    } else {
      await page.locator('.reading-actions button').filter({hasText:'设置'}).click();
    }
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('字体',{exact:true}).selectOption('sans-serif');
    await page.getByLabel('阅读方式',{exact:true}).selectOption('paged');
    await page.getByRole('button',{name:'夜间',exact:true}).last().click();
    await page.screenshot({path:info.outputPath('reading-settings-'+width+'.png')});
    await page.getByRole('button',{name:'完成',exact:true}).click();
    await expect(page.locator('.reading-workspace')).toHaveAttribute('data-mode','paged');
    await page.getByRole('button',{name:'上一页',exact:true}).click();
    await expect.poll(()=>page.locator('.reading-prose').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
  test(width+' admin sections and media scrolling',async({page}, info)=>{
    await page.setViewportSize({width,height:900});
    await page.addInitScript(()=>localStorage.setItem('boke_admin_token','fixture-admin'));
    await page.route('**/api/**',async route=>{
      const url=new URL(route.request().url()), path=url.pathname;
      const data=path==='/api/auth/me'?{id:1,username:'admin',role:'admin'}:
      path==='/api/admin/devices/register'?{token:'fixture-device'}:
      path==='/api/admin/search'? [{type:'文章',title:'UI 测试文章',url:'/admin/write/editor?id=1'}]:
      path==='/api/admin/media/explorer'?{files:Array.from({length:60},(_,i)=>({id:i+1,original_name:'文件 '+i+'.txt',path:'fixture/'+i+'.txt',mime_type:'text/plain',size:1024,created_at:'2026-09-14'})),folders:[],all_folders:[],counts:{all:60}}:
      path==='/api/admin/search-sources'?{sources:[],defaults:{}}:
      path==='/api/admin/venera-sources'?{repositories:[],sources:[]}:
      path.startsWith('/api/admin/dashboard/')?{}:
      path.startsWith('/api/admin/')||['/api/categories','/api/tags'].includes(path)?[]:fixtureResponse(url);
      await route.fulfill({json:{success:true,data}});
    });
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/admin');
    await expect(page.locator('.admin-shell')).toHaveAttribute('data-status','已连接后端 API');
    // Narrow screens collapse the sidebar; use the same button's event without a layout-dependent click.
    await page.locator('.admin-nav[data-panel=settings]').evaluate((el:HTMLElement)=>el.click());
    await expect(page.locator('#settings-search')).toHaveCount(0);
    await page.locator('#settings-panel [data-panel-tab=storage]').click();
    await expect(page.locator('#storage-panel')).toBeVisible();
    await page.locator('#storage-panel [data-panel-tab=logs]').click();
    await expect(page.locator('#logs-panel')).toBeVisible();
    await page.locator('#admin-search-toggle').click();
    await page.locator('#admin-global-settings-search').fill('UI');
    await expect(page.locator('#admin-search-results')).toContainText('UI 测试文章');
    await page.locator('#admin-global-settings-search').press('Escape');
    await page.locator('.admin-nav[data-panel=media]').evaluate((el:HTMLElement)=>el.click());
    await expect(page.locator('#media-grid')).toContainText('文件 59.txt');
    const before=await page.locator('#media-grid').boundingBox();
    expect(before!.height).toBeGreaterThan(100);
    await page.locator('#media-grid').evaluate(el=>el.scrollTop=1000);
    expect(await page.evaluate(()=>scrollY)).toBe(0);
    expect(await page.locator('#media-grid').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('media-'+width+'.png')});
    expect(errors).toEqual([]);
  });
}
