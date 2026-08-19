const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const port = 31992
const origin = `http://127.0.0.1:${port}`
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'boke-series-test-'))

async function waitForServer(child) {
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`后端提前退出：\n${output}`)
    try {
      const response = await fetch(`${origin}/api/health`)
      if (response.ok) return
    } catch {}
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
      JWT_SECRET: 'series-test-secret-at-least-thirty-two-characters',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'series-test-password',
      DB_PATH: path.join(tempRoot, 'blog.db'),
      UPLOAD_DIR: path.join(tempRoot, 'uploads'),
      CORS_ORIGIN: origin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  try {
    await waitForServer(child)
    const loginResponse = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'series-test-password' }),
    })
    const login = await loginResponse.json()
    if (!loginResponse.ok || !login.data?.token) throw new Error(`登录失败：${JSON.stringify(login)}`)
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` }

    const request = async (url, options = {}) => {
      const response = await fetch(`${origin}/api${url}`, { ...options, headers: { ...headers, ...(options.headers || {}) } })
      const body = await response.json()
      if (!response.ok || body.success === false) throw new Error(`${options.method || 'GET'} ${url} 失败：${JSON.stringify(body)}`)
      return body.data
    }

    const articleA = await request('/admin/articles', { method: 'POST', body: JSON.stringify({ title: '系列测试 上卷', content: '# 上卷', status: 'published' }) })
    const articleB = await request('/admin/articles', { method: 'POST', body: JSON.stringify({ title: '系列测试 下卷', content: '# 下卷', status: 'published' }) })
    const seriesA = await request('/admin/series', { method: 'POST', body: JSON.stringify({ title: '系列测试 第一部' }) })
    const seriesB = await request('/admin/series', { method: 'POST', body: JSON.stringify({ title: '系列测试 第二部' }) })

    await request(`/admin/series/${seriesA.id}/articles`, { method: 'PUT', body: JSON.stringify({ article_ids: [articleB.id, articleA.id] }) })
    let options = await request('/admin/series/article-options')
    const firstA = options.find((item) => item.id === articleA.id)
    const firstB = options.find((item) => item.id === articleB.id)
    if (firstB.series_id !== seriesA.id || firstB.series_order !== 1 || firstA.series_order !== 2) throw new Error('专题文章顺序未正确保存')

    await request(`/admin/series/${seriesB.id}/articles`, { method: 'PUT', body: JSON.stringify({ article_ids: [articleA.id] }) })
    options = await request('/admin/series/article-options')
    const moved = options.find((item) => item.id === articleA.id)
    const retained = options.find((item) => item.id === articleB.id)
    if (moved.series_id !== seriesB.id || moved.series_order !== 1) throw new Error('文章未正确移入另一个专题')
    if (retained.series_id !== seriesA.id || retained.series_order !== 1) throw new Error('原专题中的其他文章被错误修改')

    console.log('专题文章添加、排序与跨专题移动测试通过')
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolve) => child.once('exit', resolve))
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
