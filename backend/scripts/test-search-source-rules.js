const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const backendPort = 31995
const sourcePort = 31996
const origin = `http://127.0.0.1:${backendPort}`
const sourceOrigin = `http://127.0.0.1:${sourcePort}`
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boke-search-rules-'))
const requests = []
const getItem = { uid: 'get-1', names: { cn: '独立 GET 番剧', original: 'GET ANIME' }, poster: { large: 'https://img.example/get.jpg' }, metrics: { score: 8.7 }, aired: '2026-08', intro: 'GET 源简介', media: { label: '动画' }, episodes: 13 }
const formItem = { key: 'form-1', display: '独立表单漫画', raw_title: 'FORM MANGA', art: 'https://img.example/form.jpg', stars: '9.1', published: '2026', about: '表单源简介' }

const sourceServer = http.createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    requests.push({ method: req.method, url: req.url, body, token: req.headers['x-rule-token'] || '' })
    res.setHeader('Content-Type', 'application/json')
    const url = new URL(req.url, sourceOrigin)
    if (req.method === 'GET' && url.pathname === '/alpha/find') return res.end(JSON.stringify({ payload: { results: [getItem] } }))
    if (req.method === 'GET' && url.pathname === '/alpha/item/get-1') return res.end(JSON.stringify({ payload: { entry: getItem } }))
    if (req.method === 'POST' && url.pathname === '/beta/search') return res.end(JSON.stringify({ response: { list: [formItem] } }))
    if (req.method === 'POST' && url.pathname === '/beta/detail') return res.end(JSON.stringify({ response: { entry: formItem } }))
    res.statusCode = 404
    res.end(JSON.stringify({ error: 'not found' }))
  })
})

async function wait(child) {
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  for (let index = 0; index < 600; index += 1) {
    if (child.exitCode !== null) throw new Error(output)
    try { if ((await fetch(`${origin}/api/health`)).ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`server timeout ${output}`)
}

async function main() {
  await new Promise((resolve, reject) => sourceServer.listen(sourcePort, '127.0.0.1', resolve).on('error', reject))
  const child = spawn(process.execPath, ['dist/app.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(backendPort), BACKEND_HOST: '127.0.0.1', NODE_ENV: 'test', JWT_SECRET: 'search-rules-test-secret-at-least-32-chars', ADMIN_PASSWORD: 'test-password', DB_PATH: path.join(temp, 'blog.db'), UPLOAD_DIR: path.join(temp, 'uploads'), CORS_ORIGIN: origin }, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    await wait(child)
    const login = await (await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'test-password' }) })).json()
    const headers = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
    async function call(url, options = {}) {
      const response = await fetch(`${origin}/api${url}`, { ...options, headers: { ...headers, ...(options.headers || {}) } })
      const json = await response.json()
      if (!response.ok || json.success === false) throw Object.assign(new Error(`${url} ${JSON.stringify(json)}`), { status: response.status })
      return json.data
    }
    const getRule = { schema: 'boke-content-search-source', version: 1, source: { id: 'get-anime', label: 'GET 动画源', enabled: true, kinds: ['bangumi'], api_base: sourceOrigin, page_base: 'https://get.example', page_path: '/work/{id}', headers: { 'X-Rule-Token': 'get-secret' }, search: { method: 'GET', path: '/alpha/find?term={query}&kind={type}&take={limit}', result_path: 'payload.results', body_type: 'json' }, detail: { method: 'GET', path: '/alpha/item/{id}', result_path: 'payload.entry', body_type: 'json' }, mapping: { id: 'uid', title: 'names.cn', original_title: 'names.original', cover: 'poster.large', rating: 'metrics.score', publication: 'aired', description: 'intro', type: 'media.label', total: 'episodes' }, type_values: { bangumi: 'anime' } } }
    const formRule = { schema: 'boke-content-search-source', version: 1, source: { id: 'form-manga', label: '表单漫画源', enabled: true, kinds: ['manga'], api_base: sourceOrigin, page_base: 'https://form.example', page_path: '/comic/{id}', headers: { 'X-Rule-Token': 'form-secret' }, search: { method: 'POST', path: '/beta/search', result_path: 'response.list', body_type: 'form', body: { word: '{query}', category: '{type}', take: '{limit}' } }, detail: { method: 'POST', path: '/beta/detail', result_path: 'response.entry', body_type: 'form', body: { subject_id: '{id}' } }, mapping: { id: 'key', title: 'display', original_title: 'raw_title', cover: 'art', rating: 'stars', publication: 'published', description: 'about' }, type_values: { manga: 'comic' } } }
    await call('/admin/search-sources/import', { method: 'POST', body: JSON.stringify(getRule) })
    await call('/admin/search-sources/import', { method: 'POST', body: JSON.stringify(formRule) })
    const config = await call('/admin/search-sources')
    config.defaults = { bangumi: 'get-anime', manga: 'form-manga' }
    await call('/admin/search-sources', { method: 'PUT', body: JSON.stringify(config) })
    const anime = await call('/admin/bangumi/search?q=test&source=official')
    const manga = await call('/admin/manga/search?q=test&source=official')
    const detail = await call('/admin/manga/search?id=form-1')
    if (anime[0]?.title !== '独立 GET 番剧' || anime[0]?.total_episodes !== 13 || anime[0]?.url !== 'https://get.example/work/get-1') throw new Error('GET rule mapping/default isolation failed')
    if (manga[0]?.title !== '独立表单漫画' || manga[0]?.source_url !== 'https://form.example/comic/form-1' || detail[0]?.external_id !== 'form-1') throw new Error('form rule mapping/default isolation failed')
    const getRequest = requests.find((item) => item.url.startsWith('/alpha/find'))
    const formSearch = requests.find((item) => item.url === '/beta/search')
    const formDetail = requests.find((item) => item.url === '/beta/detail')
    if (!getRequest?.url.includes('kind=anime') || getRequest.token !== 'get-secret') throw new Error('GET request rule failed')
    if (formSearch?.body !== 'word=test&category=comic&take=20' || formSearch.token !== 'form-secret') throw new Error('form search rule failed')
    if (formDetail?.body !== 'subject_id=form-1') throw new Error('form detail rule failed')
    let invalidRejected = false
    try { await call('/admin/search-sources/import', { method: 'POST', body: JSON.stringify({ ...getRule, source: { ...getRule.source, id: 'invalid', mapping: { title: 'names.cn' } } }) }) } catch (error) { invalidRejected = error.status === 400 }
    if (!invalidRejected) throw new Error('invalid mapping rule was accepted')
    console.log(JSON.stringify({ success: true, independent_files: 2, get_rule: true, form_rule: true, detail_post: true, default_source_enforced: true, invalid_rule_rejected: true }, null, 2))
  } finally {
    child.kill('SIGTERM')
    sourceServer.close()
    await new Promise((resolve) => setTimeout(resolve, 250))
    fs.rmSync(temp, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
