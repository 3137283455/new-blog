const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'boke-dynamic-import-')), 'test.db');
const web = require('../dist/services/web-fetch');
const renderer = require('../dist/services/web-renderer');
const {prepareArticleHtml,canonicalArticleUrl,articleSite,verificationResponse,WebArticleError} = require('../dist/services/web-article');
const db = require('../dist/config/database').default;
require('../dist/database/schema').migrate();
const {preview,commit,extractArticleFromUrl,cleanExtractedHtml} = require('../dist/controllers/web-import');
const userId = Number(db.prepare("INSERT INTO users (username,password_hash,role) VALUES ('dynamic-test','hash','admin')").run().lastInsertRowid);
const paragraphs = Array.from({length:8}, (_,i) => `<p>第${i}段文章正文：保留完整图文、段落和来源链接，支持浏览器加载后提取以及从已打开的文章粘贴导入，不混入导航、推荐内容和评论区。保存时只能创建私密草稿，等待用户审核。</p>`).join('');
const article = `<html><head><title>动态文章标题</title></head><body><nav>不应导入的导航菜单</nav><div class="opus-module-content">${paragraphs}<img data-src="/image.png"></div><aside>不应导入的推荐内容</aside></body></html>`;
function res() {return {statusCode:200,body:null,status(value){this.statusCode=value;return this},json(value){this.body=value;return this}};}

test('known-site scoping retains lazy images and removes unrelated content', () => {
  const prepared = prepareArticleHtml(article, 'https://www.bilibili.com/opus/123');
  assert.equal(prepared.scoped,true);
  assert.ok(!prepared.html.includes('不应导入'));
  assert.ok(prepared.html.includes('https://www.bilibili.com/image.png'));
  assert.equal(canonicalArticleUrl('https://m.bilibili.com/opus/123?share_source=COPY'), 'https://www.bilibili.com/opus/123');
  assert.equal(articleSite('https://bilibili.com.evil.example/opus/123'),undefined);
  assert.throws(() => prepareArticleHtml('<body>首页 登录 社区 加速器</body>', 'https://xiaoheihe.cn/app/bbs/link/1'), /尚未加载/);
  assert.equal(verificationResponse('{"status":"show_captcha","result":{}}'),true);
  assert.equal(verificationResponse('{"status":"ok"}'),false);
});

test('empty static article uses rendered HTML and preserves exact body', async () => {
  const originalFetch = web.fetchWeb, originalRender = renderer.renderWebArticle;
  let renders = 0;
  web.fetchWeb = async () => ({bytes:Buffer.from('<body><div id="app"></div></body>'),type:'text/html',url:'https://www.bilibili.com/opus/123'});
  renderer.renderWebArticle = async () => {renders++;return {html:article,url:'https://www.bilibili.com/opus/123'};};
  try {
    const result = await extractArticleFromUrl('https://b23.tv/test');
    assert.equal(result.method,'browser'); assert.equal(renders,1);
    const cleaned = cleanExtractedHtml(result.extracted.html,result.url);
    assert.equal(cleaned.images.length,1);
    assert.ok(cleaned.text.includes('第7段'));
    assert.ok(!cleaned.text.includes('不应导入'));
  } finally {web.fetchWeb=originalFetch;renderer.renderWebArticle=originalRender;}
});

test('captcha cannot become a successful article preview', async () => {
  const originalFetch = web.fetchWeb, originalRender = renderer.renderWebArticle;
  web.fetchWeb = async () => ({bytes:Buffer.from('<body>首页 登录 社区</body>'),type:'text/html',url:'https://xiaoheihe.cn/app/bbs/link/1'});
  renderer.renderWebArticle = async () => {throw new WebArticleError('需要人工验证','VERIFICATION_REQUIRED');};
  try {
    const output=res(); await preview({userId,body:{url:'https://xiaoheihe.cn/app/bbs/link/1'}},output);
    assert.equal(output.body.success,false);assert.equal(output.body.code,'VERIFICATION_REQUIRED');
  } finally {web.fetchWeb=originalFetch;renderer.renderWebArticle=originalRender;}
});

test('pasted article bypasses remote captcha and safely creates a publishable draft', async () => {
  const originalFetch = web.fetchWeb;
  web.fetchWeb = async () => {throw new Error('Pasted preview must not request the source website');};
  try {
    const output=res();
    await preview({userId,body:{url:'https://xiaoheihe.cn/app/bbs/link/188764135',title:'粘贴的真实标题',html:`<html><body><article><h1>网页文章</h1>${paragraphs}<img src="https://example.com/cover.jpg" onerror="alert(1)"><script>badScript()</script></article></body></html>`}},output);
    assert.equal(output.body.success,true,output.body.message);
    assert.equal(output.body.data.title,'粘贴的真实标题');
    assert.equal(output.body.data.method,'clipboard');
    assert.equal(output.body.data.images.length,1);
    assert.ok(!/badScript|onerror|<img/.test(output.body.data.html));
    const saved=res();await commit({userId,body:{preview_id:output.body.data.preview_id,mode:'draft',image_ids:[]}},saved);
    assert.equal(saved.body.success,true,saved.body.message);
    const row=db.prepare('SELECT * FROM articles WHERE id=?').get(saved.body.data.id);
    assert.equal(row.status,'draft');assert.equal(row.visibility,'public');
    assert.ok(row.content.includes('第7段'));assert.ok(row.content.includes('188764135'));
  } finally {web.fetchWeb=originalFetch;}
});

test('reject malformed and oversized pasted HTML', async () => {
  for (const html of [123, 'x'.repeat(6*1024*1024+1)]) {
    const output=res();await preview({userId,body:{url:'https://example.com/article',html}},output);
    assert.equal(output.body.success,false);
  }
});
