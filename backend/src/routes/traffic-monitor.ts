import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { createHmac } from 'node:crypto'
import { spawn, ChildProcess } from 'node:child_process'
import path from 'node:path'
import db from '../config/database'
import { config } from '../config'
import { auth, adminOnly, AuthRequest } from '../middleware/auth'

const router = Router()
const cookieName = 'boke_traffic_session'
const bridgeKey = createHmac('sha256', config.jwtSecret).update('traffic-monitor-bridge-v1').digest('hex')
const port = Number(process.env.TRAFFIC_PORT || 8098)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('TRAFFIC_PORT 格式不正确')
const origin = `http://127.0.0.1:${port}`
const base = '/api/traffic'
let child: ChildProcess | undefined
let starting: Promise<void> | undefined
let activePublicUrl = ''
let stopping = false
let restartTimer: ReturnType<typeof setTimeout> | undefined
function scheduleRestart() {
  if (stopping || restartTimer || config.nodeEnv === 'test') return
  restartTimer = setTimeout(() => {
    restartTimer = undefined
    ensureService(activePublicUrl || 'http://localhost:3002').catch(() => scheduleRestart())
  }, 30000)
  restartTimer.unref()
}

function publicUrl(req: Request) {
  // Browser authentication follows the actual admin origin. The collector's public
  // HTTPS endpoint can be different (e.g. admin accessed by an HTTP IP address).
  const configured = req.get('origin') || `${req.protocol}://${req.get('host')}`
  const url = new URL(configured)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('监控站点地址无效')
  return url.origin
}
async function healthy() {
  try {
    const response = await fetch(`${origin}${base}/api/session`, {
      headers: { 'X-Blog-Traffic-Key': bridgeKey }, signal: AbortSignal.timeout(500),
    })
    return response.ok && (await response.json() as any).authenticated === true
  } catch { return false }
}
async function ensureService(site: string) {
  activePublicUrl = process.env.TRAFFIC_PUBLIC_URL ? new URL(process.env.TRAFFIC_PUBLIC_URL).origin : site
  if (starting) return starting
  if (child && child.exitCode === null && await healthy()) return
  starting = (async () => {
    if (!child || child.exitCode !== null) {
      activePublicUrl = process.env.TRAFFIC_PUBLIC_URL ? new URL(process.env.TRAFFIC_PUBLIC_URL).origin : site
      const runtime = process.env.TRAFFIC_PYTHON || process.env.WEB_IMPORT_PYTHON || 'python3'
      child = spawn(runtime, ['-u', path.resolve(__dirname, '../../../services/traffic-monitor/scripts/run_integrated.py')], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, TRAFFIC_BRIDGE_KEY: bridgeKey, TRAFFIC_PORT: String(port),
          TRAFFIC_PUBLIC_URL: activePublicUrl, TRAFFIC_DATA_DIR: path.resolve(path.dirname(config.dbPath), 'traffic-monitor'),
          PYTHONDONTWRITEBYTECODE: '1', PYTHONUNBUFFERED: '1' },
      })
      const processRef = child
      child.on('error', () => { if (child === processRef) { child = undefined; scheduleRestart() } })
      child.on('exit', () => { if (child === processRef) { child = undefined; scheduleRestart() } })
      child.stdout?.on('data', () => {})
      child.stderr?.on('data', chunk => console.error('[traffic-monitor]', String(chunk).trim()))
    }
    for (let attempt = 0; attempt < 25; attempt++) {
      if (await healthy()) return
      if (!child) break
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    throw new Error('流量监控启动失败，请确认服务器已安装 Python 3.11+，且 8098 端口未被其他服务占用。')
  })().finally(() => { starting = undefined })
  return starting
}
export function startTrafficMonitor() {
  let site = process.env.TRAFFIC_PUBLIC_URL || 'http://localhost:3002'
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'site_url'").get() as { value: string } | undefined
    if (!process.env.TRAFFIC_PUBLIC_URL && /^https?:\/\//.test(row?.value || '')) site = new URL(row!.value).origin
  } catch { /* The monitor also starts on the first authenticated request. */ }
  ensureService(site).catch(cause => console.error('[traffic-monitor]', cause.message))
}
process.once('exit', () => { stopping = true; child?.kill() })
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { stopping = true; child?.kill(); process.exit(0) })

router.post('/session', auth, adminOnly, async (req: AuthRequest, res) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (!db.prepare("SELECT id FROM users WHERE id = ? AND role = 'admin'").get(req.userId!)) {
      return res.status(403).json({ success: false, message: '当前账号没有流量监控权限' })
    }
    const site = publicUrl(req)
    await ensureService(site)
    const parent = jwt.decode(req.get('authorization')!.slice(7)) as jwt.JwtPayload
    const lifetime = Math.min(15 * 60, Number(parent.exp) - Math.floor(Date.now() / 1000))
    if (!Number.isFinite(lifetime) || lifetime <= 0) return res.status(401).json({ success: false, message: '后台登录已过期' })
    const ticket = jwt.sign({ id: req.userId, role: 'admin', site }, config.jwtSecret, { audience: 'traffic-monitor', expiresIn: lifetime })
    res.cookie(cookieName, ticket, { httpOnly: true, sameSite: 'strict', secure: site.startsWith('https:'), path: base, maxAge: lifetime * 1000 })
    return res.json({ success: true, data: { ready: true } })
  } catch (cause) {
    return res.status(503).json({ success: false, message: cause instanceof Error ? cause.message : '流量监控启动失败' })
  }
})
router.delete('/session', (_req, res) => {
  res.clearCookie(cookieName, { path: base, httpOnly: true, sameSite: 'strict' })
  return res.setHeader('Cache-Control', 'no-store').json({ success: true })
})

router.use(async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  const ingest = req.method === 'POST' && req.path === '/api/ingest'
  let site = activePublicUrl
  if (!ingest) {
    try {
      const ticket = jwt.verify(req.cookies?.[cookieName] || '', config.jwtSecret, { audience: 'traffic-monitor' }) as jwt.JwtPayload
      const user = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'admin'").get(Number(ticket.id))
      if (!user || ticket.role !== 'admin') throw new Error('not admin')
      site = String(ticket.site || activePublicUrl)
    } catch { return res.status(401).json({ error: '后台登录已过期，请重新进入流量监控' }) }
  }
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: '请求方式不支持' })
  if (!/^\/(?:view|app\.js|style\.css|api\/[a-zA-Z0-9_/-]+)$/.test(req.path)) return res.status(404).json({ error: '页面不存在' })
  if (!ingest && req.method === 'POST' && req.get('X-Traffic-Request') !== '1') return res.status(403).json({ error: '请求来源无效' })
  try {
    if (!child || child.exitCode !== null) {
      if (ingest) return res.status(503).json({ error: '监控服务尚未启动，请先从后台进入流量监控；采集器将稍后重试' })
      await ensureService(publicUrl(req))
    }
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
    const target = `${origin}${base}${req.path === '/view' ? '/' : req.path}${query}`
    const headers: Record<string, string> = { Accept: req.get('Accept') || '*/*' }
    if (ingest) headers.Authorization = req.get('Authorization') || ''
    else {
      headers['X-Blog-Traffic-Key'] = bridgeKey
      headers['X-Blog-Public-Origin'] = process.env.TRAFFIC_PUBLIC_URL ? new URL(process.env.TRAFFIC_PUBLIC_URL).origin : site
    }
    const body = req.method === 'POST' ? JSON.stringify(req.body || {}) : undefined
    if (body && Buffer.byteLength(body) > 2_000_000) return res.status(413).json({ error: '请求内容过大' })
    if (body) { headers['Content-Type'] = 'application/json'; headers['X-Traffic-Request'] = '1' }
    // The Python service sees only requests authorized here; its CSRF check uses the configured site origin.
    if (!ingest && req.get('origin')) {
      if (req.get('origin') !== site) return res.status(403).json({ error: '请求来源无效' })
      headers.Origin = site
    }
    const response = await fetch(target, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(15000) })
    for (const name of ['Content-Type', 'Content-Disposition', 'Content-Security-Policy', 'X-Content-Type-Options']) {
      const value = response.headers.get(name)
      if (value) res.setHeader(name, value)
    }
    if (req.path === '/api/logout') res.clearCookie(cookieName, { path: base })
    return res.status(response.status).send(Buffer.from(await response.arrayBuffer()))
  } catch { return res.status(503).json({ error: '流量监控暂不可用，请在后台点击重新连接' }) }
})
export default router
