const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'boke-web-import-'));
process.env.DB_PATH = path.join(sandbox,'test.db');
process.env.UPLOAD_DIR = path.join(sandbox,'uploads');
const {publicAddress,webUrl,fetchWeb} = require('../dist/services/web-fetch');
const db = require('../dist/config/database').default;
const {migrate} = require('../dist/database/schema');
migrate();
const {extractWebHtml,cleanExtractedHtml,commit,preview} = require('../dist/controllers/web-import');
const {saveArticleSources,articleSources} = require('../dist/services/article-sources');

test('reject local and reserved addresses including mapped IPv6', async () => {
  for (const address of ['127.0.0.1','10.0.0.2','192.168.1.1','172.16.1.2','169.254.169.254','0.0.0.0','::1','::ffff:127.0.0.1','fc00::1','224.0.0.1']) assert.equal(publicAddress(address),false,address);
  assert.equal(publicAddress('8.8.8.8'),true);
  assert.throws(() => webUrl('file:///etc/passwd'));
  assert.throws(() => webUrl('https://user:pass@example.com'));
  assert.throws(() => webUrl('http://example.com:3001'));
  await assert.rejects(fetchWeb('http://127.0.0.1'),/不允许/);
});
test('sanitize extracted HTML and isolate external pictures', () => {
  const result = cleanExtractedHtml('<h2>内容</h2><p onclick="evil()">正文<a href="/article">链接</a></p><script>alert(1)</script><img src="/cover.jpg" onerror="evil()"><iframe src="https://example.com"></iframe><a href="javascript:evil()">坏链接</a>','https://example.com/post');
  assert.ok(!/onclick|onerror|script|iframe/.test(result.html));
  assert.equal(result.images[0].url,'https://example.com/cover.jpg');
  assert.ok(result.html.includes('https://boke-import.invalid/image/1'));
  assert.ok(result.html.includes('https://example.com/article'));
});
test('real Trafilatura extracts Chinese HTML offline', async () => {
  const html = '<html><head><title>测试写作素材</title></head><body><nav>导航菜单</nav><article><h1>测试写作素材</h1>' + Array.from({length:8},(_,i) => '<p>这是第'+i+'段中文正文，测试提取引擎保留文章结构和真实内容，不保留网页导航与广告。每段包含足够的信息以便进行正文识别和阅读。支持个人写作和素材整理。</p>').join('') + '<img src="https://example.com/a.png" alt="文章插图"></article></body></html>';
  const result = await extractWebHtml(html,'https://example.com/post');
  assert.equal(result.title,'测试写作素材');
  assert.ok(result.html.includes('中文正文'));
  assert.ok(!result.html.includes('导航菜单'));
});
test('article provenance persists and deduplicates per source', () => {
  const user = db.prepare("INSERT INTO users (username,password_hash,role) VALUES ('test','hash','admin')").run();
  const id = Number(db.prepare("INSERT INTO articles (title,slug,content,author_id) VALUES ('sample','sample','text',?)").run(user.lastInsertRowid).lastInsertRowid);
  const sources = [{source_url:'https://example.com/a',final_url:'https://example.com/a',title:'Original',fingerprint:'abc'}];
  saveArticleSources(id,sources); saveArticleSources(id,sources);
  assert.equal(articleSources(id).length,1);
});
test('expired preview cannot be committed', async () => {
  let code, body;
  const res = {status(value){code=value;return this},json(value){body=value;return this}};
  await commit({userId:1,body:{preview_id:'missing',mode:'draft'}},res);
  assert.equal(code,410);
  assert.equal(body.success,false);
});
test('preview to draft is idempotent, private and detects duplicates', async () => {
  const web = require('../dist/services/web-fetch');
  const original = web.fetchWeb;
  const document = '<html><head><title>从网页创建草稿</title></head><body><article><h1>从网页创建草稿</h1>'+Array.from({length:8},(_,i)=>'<p>第'+i+'部分，这是独立的导入集成测试，验证网页内容可以提取成结构化的文章，并且在保存后继续编辑和阅读。保存为私密草稿不会向外发布内容，作者可以审核并修改后再决定发布。</p>').join('')+'</article></body></html>';
  web.fetchWeb = async () => ({bytes:Buffer.from(document),type:'text/html; charset=utf-8',url:'https://example.com/integration'});
  function response() { return {statusCode:200,body:null,status(value){this.statusCode=value;return this},json(value){this.body=value;return this}}; }
  try {
    const userId = db.prepare("SELECT id FROM users WHERE username='test'").get().id;
    const first = response(); await preview({userId,body:{url:'https://example.com/integration'}},first);
    assert.equal(first.body.success,true,first.body.message);
    const args={userId,body:{preview_id:first.body.data.preview_id,mode:'draft',image_ids:[],title:'我的网页草稿'}};
    const saved=response(); await commit(args,saved);
    assert.equal(saved.body.success,true,saved.body.message);
    const id=saved.body.data.id;
    const row=db.prepare('SELECT * FROM articles WHERE id=?').get(id);
    assert.equal(row.title,'我的网页草稿'); assert.equal(row.status,'draft'); assert.equal(row.visibility,'private');
    assert.ok(row.content.includes('来源：')); assert.equal(articleSources(id).length,1);
    const again=response();await commit(args,again);assert.equal(again.body.data.id,id);
    const second=response();await preview({userId,body:{url:'https://example.com/integration'}},second);
    assert.equal(second.body.data.duplicates[0].id,id);
    const denied=response();await commit({userId,body:{preview_id:second.body.data.preview_id,mode:'draft'}},denied);
    assert.equal(denied.statusCode,409);
    const other=response();await commit({userId:userId+1,body:{preview_id:second.body.data.preview_id,mode:'draft'}},other);
    assert.equal(other.statusCode,410);
  } finally { web.fetchWeb=original; }
});
