// End-to-end test against the bundled Python monitor, with isolated databases.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { gunzipSync } = require('node:zlib')
const jwt = require('jsonwebtoken')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boke-traffic-'))
const origin = 'http://127.0.0.1:31978'
const publicIngestOrigin = process.env.TRAFFIC_TEST_PUBLIC_URL || origin
const secret = 'traffic-integration-test-secret-not-production'
let backend
let output = ''
let cookie = ''
let token = ''
async function start() {
  backend = spawn(process.execPath, ['dist/app.js'], { cwd: path.resolve(__dirname, '..'), windowsHide: true,
    env: { ...process.env, PORT: '31978', TRAFFIC_PORT: '31979', NODE_ENV: 'test', BACKEND_HOST: '127.0.0.1',
      DB_PATH: path.join(temp, 'blog.db'), UPLOAD_DIR: path.join(temp, 'uploads'),
      JWT_SECRET: secret, ADMIN_PASSWORD: 'test-password', TRAFFIC_PUBLIC_URL: publicIngestOrigin }, stdio: ['ignore', 'pipe', 'pipe'] })
  backend.stdout.on('data', chunk => { output += chunk })
  backend.stderr.on('data', chunk => { output += chunk })
  for (let count = 0; count < 100; count++) {
    if (backend.exitCode !== null) throw new Error(output)
    try { if ((await fetch(`${origin}/api/health`)).ok) return } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Backend did not start: ' + output)
}
async function stop() {
  if (backend && backend.exitCode === null) {
    const closed = new Promise(resolve => backend.once('exit', resolve))
    backend.kill('SIGTERM')
    await closed
  }
  await new Promise(resolve => setTimeout(resolve, 300))
}
async function request(url, options = {}) {
  const headers = { ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) }
  return fetch(`${origin}/api/traffic${url}`, { ...options, headers })
}
async function session() {
  const response = await request('/session', { method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: origin } })
  assert.equal(response.status, 200, await response.text())
  const set = response.headers.get('set-cookie')
  assert.match(set, /HttpOnly/i)
  assert.match(set, /SameSite=Strict/i)
  assert.doesNotMatch(set, /; Secure/i) // The admin test origin is HTTP, even if ingest is HTTPS.
  cookie = set.split(';')[0]
}
async function post(url, data, headers = {}) {
  return request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Traffic-Request': '1', Origin: origin, ...headers }, body: JSON.stringify(data) })
}
async function main() {
  try {
    await start()
    assert.equal((await request('/view')).status, 401)
    assert.equal((await request('/api/fleet')).status, 401)
    const login = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'test-password' }) })
    token = (await login.json()).data.token
    const wrongRole = jwt.sign({ id: 1, role: 'author' }, secret, { expiresIn: '5m' })
    assert.equal((await request('/session', { method: 'POST', headers: { Authorization: `Bearer ${wrongRole}`, Origin: origin } })).status, 403)
    await session()
    const view = await request('/view')
    assert.equal(view.status, 200)
    assert.match(view.headers.get('content-security-policy'), /frame-ancestors 'self'/)
    assert.equal(view.headers.get('cache-control'), 'no-store')
    assert.match(await view.text(), /全部节点/)
    assert.equal((await request('/app.js')).status, 200)
    assert.equal((await request('/style.css')).status, 200)
    const monitorSession = await (await request('/api/session')).json()
    assert.equal(monitorSession.authenticated, true)
    assert.equal(monitorSession.ingest_url, `${publicIngestOrigin}/api/traffic/api/ingest`)
    assert.equal((await (await request('/api/fleet')).json()).nodes.length, 0)
    assert.equal((await request('/api/nodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403)
    assert.equal((await post('/api/nodes', {}, { Origin: 'https://untrusted.example' })).status, 403)
    const create = await post('/api/nodes', { name: '集成测试 VPS', timezone: 'Asia/Shanghai' })
    assert.equal(create.status, 201)
    const node = await create.json()
    assert.ok(node.node_id && node.token)
    const payload = { node_id: node.node_id, generation: 'test', buckets: [{ start: Math.floor(Date.now() / 300000) * 300 - 300, rx: 123, tx: 456 }] }
    cookie = '' // Ingestion authenticates with a node token, never an admin cookie.
    assert.equal((await post('/api/ingest', payload, { Authorization: 'Bearer wrong' })).status, 401)
    assert.equal((await post('/api/ingest', payload, { Authorization: `Bearer ${node.token}` })).status, 200)
    assert.equal((await post('/api/ingest', payload, { Authorization: `Bearer ${node.token}` })).status, 200)
    await session()
    const details = await (await request(`/api/nodes/${node.node_id}`)).json()
    assert.equal(details.summary.rx, 123)
    assert.equal(details.summary.tx, 456)
    assert.ok(!JSON.stringify(details).includes(node.token))
    const archive = await post(`/api/nodes/${node.node_id}/package`, { token: node.token })
    assert.equal(archive.status, 200)
    const raw = gunzipSync(Buffer.from(await archive.arrayBuffer())).toString('utf8')
    assert.ok(raw.includes(`INGEST_URL=${publicIngestOrigin}/api/traffic/api/ingest`))
    assert.ok(raw.includes('agent/collector.py'))
    const csv = await request(`/api/nodes/${node.node_id}/export`)
    assert.equal(csv.status, 200)
    assert.match(csv.headers.get('content-disposition'), /attachment/)
    assert.match(await csv.text(), /rx_bytes/)
    const sshCreate = await post('/api/nodes', { name: 'VirNAT SSH test', collection_mode: 'ssh', host: '203.0.113.42', ssh_port: 3101 })
    assert.equal(sshCreate.status, 201)
    const sshNode = await sshCreate.json()
    assert.equal(sshNode.token, undefined)
    const setup = await request(`/api/nodes/${sshNode.node_id}/ssh-setup`)
    assert.equal(setup.status, 200)
    const sshSetup = await setup.json()
    assert.match(sshSetup.public_key, /^ssh-ed25519 /)
    assert.match(sshSetup.commands, /restrict,command=/)
    assert.ok(!JSON.stringify(sshSetup).includes('PRIVATE KEY'))
    const noPin = await post(`/api/nodes/${sshNode.node_id}/ssh-pull`, {})
    assert.equal(noPin.status, 400)
    assert.match((await noPin.json()).error, /主机指纹/)
    assert.equal((await post(`/api/nodes/${sshNode.node_id}/ssh-fingerprint`, { fingerprint: 'bad' })).status, 400)
    assert.equal((await post(`/api/nodes/${sshNode.node_id}/ssh-fingerprint`, { fingerprint: 'SHA256:' + 'A'.repeat(43) })).status, 200)
    assert.equal((await post('/api/ingest', { ...payload, node_id: sshNode.node_id }, { Authorization: `Bearer ${sshNode.token}` })).status, 401)
    await stop()
    await start()
    cookie = ''
    await session()
    const restored = await (await request('/api/fleet')).json()
    const restoredNode = restored.nodes.find(n => n.id === node.node_id)
    assert.equal(restoredNode.summary.tx, 456)
    const restoredSSH = restored.nodes.find(n => n.id === sshNode.node_id)
    assert.equal(restoredSSH.config.collection_mode, 'ssh')
    assert.equal(restoredSSH.config.ssh_fingerprint, 'SHA256:' + 'A'.repeat(43))
    assert.equal((await post(`/api/nodes/${sshNode.node_id}/delete`, { confirm_name: 'wrong name' })).status, 400)
    assert.equal((await request(`/api/nodes/${sshNode.node_id}/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm_name: 'VirNAT SSH test' }) })).status, 403)
    assert.equal((await post(`/api/nodes/${sshNode.node_id}/delete`, { confirm_name: 'VirNAT SSH test' }, { Origin: 'https://untrusted.example' })).status, 403)
    assert.equal((await post(`/api/nodes/${sshNode.node_id}/delete`, { confirm_name: 'VirNAT SSH test' })).status, 200)
    assert.equal((await request(`/api/nodes/${sshNode.node_id}`)).status, 404)
    assert.equal((await post(`/api/nodes/${sshNode.node_id}/delete`, { confirm_name: 'VirNAT SSH test' })).status, 404)
    const remaining = await (await request('/api/fleet')).json()
    assert.equal(remaining.nodes.length, 1)
    assert.equal(remaining.nodes[0].id, node.node_id)
    await stop()
    await start()
    cookie = ''
    await session()
    assert.equal((await (await request('/api/fleet')).json()).nodes.length, 1)
    assert.equal((await request('/session', { method: 'DELETE' })).status, 200)
    cookie = ''
    assert.equal((await request('/api/fleet')).status, 401)
    console.log('Traffic monitor integration passed: embedded assets, shared admin login, authorization, CSRF, ingestion, deduplication, package, CSV and restart persistence.')
  } finally {
    await stop()
    assert.equal(path.dirname(temp), path.resolve(os.tmpdir()))
    assert.ok(path.basename(temp).startsWith('boke-traffic-'))
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
