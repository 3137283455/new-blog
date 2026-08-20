const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const port = 31993
const origin = `http://127.0.0.1:${port}`
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'boke-media-test-'))

async function waitForServer(child) {
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`后端提前退出：\n${output}`)
    try { if ((await fetch(`${origin}/api/health`)).ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`后端启动超时：\n${output}`)
}

async function main() {
  const child = spawn(process.execPath, ['dist/app.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      BACKEND_HOST: '127.0.0.1',
      NODE_ENV: 'test',
      JWT_SECRET: 'media-test-secret-at-least-thirty-two-characters',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'media-test-password',
      DB_PATH: path.join(tempRoot, 'blog.db'),
      UPLOAD_DIR: path.join(tempRoot, 'uploads'),
      CORS_ORIGIN: origin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  try {
    await waitForServer(child)
    const loginResponse = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'media-test-password' }) })
    const login = await loginResponse.json()
    if (!login.data?.token) throw new Error(`登录失败：${JSON.stringify(login)}`)
    const auth = { Authorization: `Bearer ${login.data.token}` }

    const upload = async (name, type, content) => {
      const form = new FormData()
      form.append('file', new Blob([content], { type }), name)
      const response = await fetch(`${origin}/api/admin/media/upload`, { method: 'POST', headers: auth, body: form })
      const body = await response.json()
      if (!response.ok) throw new Error(`上传失败：${JSON.stringify(body)}`)
      return body.data
    }
    const image = await upload('cover.png', 'image/png', Buffer.from('89504e47', 'hex'))
    const audio = await upload('theme.mp3', 'audio/mpeg', Buffer.from('494433', 'hex'))
    const document = await upload('notes.txt', 'text/plain', 'hello')
    if (image.category !== 'image' || audio.category !== 'audio' || document.category !== 'document') throw new Error('上传文件没有按类型自动归类')

    const foldersResponse = await fetch(`${origin}/api/admin/media/folders`, { headers: auth })
    const folders = (await foldersResponse.json()).data
    if (folders.all !== 3 || folders.image !== 1 || folders.audio !== 1 || folders.document !== 1) throw new Error(`文件夹统计错误：${JSON.stringify(folders)}`)

    const documentsResponse = await fetch(`${origin}/api/admin/media?type=document&pageSize=20`, { headers: auth })
    const documents = (await documentsResponse.json()).data
    if (documents.length !== 1 || documents[0].original_name !== 'notes.txt') throw new Error('文档文件夹筛选错误')

    await fetch(`${origin}/api/admin/settings`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { site_title: '持久化测试站点', enable_comments: false } }) })
    const settingsResponse = await fetch(`${origin}/api/admin/settings`, { headers: auth })
    const settings = (await settingsResponse.json()).data
    const map = Object.fromEntries(settings.map((item) => [item.key, item]))
    if (map.site_title?.value !== '持久化测试站点' || map.enable_comments?.value !== 'false') throw new Error('站点设置没有持久保存')

    console.log('媒体自动分类、文件夹筛选与站点设置持久化测试通过')
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolve) => child.once('exit', resolve))
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
