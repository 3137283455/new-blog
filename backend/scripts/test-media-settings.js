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

    const upload = async (name, type, content, folderId = null) => {
      const form = new FormData()
      form.append('file', new Blob([content], { type }), name)
      if (folderId !== null) form.append('folder_id', String(folderId))
      const response = await fetch(`${origin}/api/admin/media/upload`, { method: 'POST', headers: auth, body: form })
      const body = await response.json()
      if (!response.ok) throw new Error(`上传失败：${JSON.stringify(body)}`)
      return body.data
    }
    const createFolderResponse = await fetch(`${origin}/api/admin/media/folders`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Writing', parent_id: null }),
    })
    const createdFolder = (await createFolderResponse.json()).data
    if (!createFolderResponse.ok || !createdFolder?.id) throw new Error('Unable to create media folder')

    const image = await upload('cover.png', 'image/png', Buffer.from('89504e47', 'hex'))
    const audio = await upload('theme.mp3', 'audio/mpeg', Buffer.from('494433', 'hex'))
    const document = await upload('notes.txt', 'text/plain', 'hello', createdFolder.id)
    if (image.category !== 'image' || audio.category !== 'audio' || document.category !== 'document') throw new Error('上传文件没有按类型自动归类')

    const foldersResponse = await fetch(`${origin}/api/admin/media/folders`, { headers: auth })
    const folders = (await foldersResponse.json()).data
    if (folders.all !== 3 || folders.image !== 1 || folders.audio !== 1 || folders.document !== 1) throw new Error(`文件夹统计错误：${JSON.stringify(folders)}`)

    const documentsResponse = await fetch(`${origin}/api/admin/media?type=document&pageSize=20`, { headers: auth })
    const documents = (await documentsResponse.json()).data
    if (documents.length !== 1 || documents[0].original_name !== 'notes.txt') throw new Error('文档文件夹筛选错误')

    await fetch(`${origin}/api/admin/settings`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { site_title: '持久化测试站点', site_author: '测试作者', site_language: 'ja-JP', footer_text: '测试页脚', banner_interval: 1, enable_rss: false, show_visitor_stats: false, allow_search_indexing: false, enable_comments: false, bangumi_search_source: 'official' } }) })
    const settingsResponse = await fetch(`${origin}/api/admin/settings`, { headers: auth })
    const publicSettingsResponse = await fetch(`${origin}/api/settings/public`)
    const folderExplorerResponse = await fetch(`${origin}/api/admin/media/explorer?folderId=${createdFolder.id}&sort=name&order=asc`, { headers: auth })
    const folderExplorer = (await folderExplorerResponse.json()).data
    if (folderExplorer.files.length !== 1 || folderExplorer.files[0].original_name !== 'notes.txt') throw new Error('Folder explorer did not return the uploaded file')
    if (folderExplorer.breadcrumb[0]?.name !== 'Writing') throw new Error('Folder breadcrumb is incorrect')

    const createFileResponse = await fetch(`${origin}/api/admin/media/files`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'draft.md', folder_id: createdFolder.id, content: '# draft' }),
    })
    const createdFile = (await createFileResponse.json()).data
    if (!createFileResponse.ok || createdFile?.folder_id !== createdFolder.id) throw new Error('Unable to create a file in the selected folder')

    const occupiedDelete = await fetch(`${origin}/api/admin/media/folders/${createdFolder.id}`, { method: 'DELETE', headers: auth })
    if (occupiedDelete.ok) throw new Error('Non-empty folders must not be deleted')

    const renameResponse = await fetch(`${origin}/api/admin/media/${createdFile.id}`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'idea.md', folder_id: null }),
    })
    const renamed = (await renameResponse.json()).data
    if (!renameResponse.ok || renamed.original_name !== 'idea.md' || renamed.folder_id !== null) throw new Error('File rename or move failed')

    await fetch(`${origin}/api/admin/media/${document.id}`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: null }),
    })
    const deleteFolderResponse = await fetch(`${origin}/api/admin/media/folders/${createdFolder.id}`, { method: 'DELETE', headers: auth })
    if (!deleteFolderResponse.ok) throw new Error('Empty folder could not be deleted')

    const settings = (await settingsResponse.json()).data
    const map = Object.fromEntries(settings.map((item) => [item.key, item]))
    const publicSettings = (await publicSettingsResponse.json()).data
    if (map.site_title?.value !== '持久化测试站点' || map.site_author?.value !== '测试作者' || map.site_language?.value !== 'ja-JP' || map.banner_interval?.value !== '3' || map.enable_comments?.value !== 'false' || map.bangumi_search_source?.value !== 'official') throw new Error('站点设置没有持久保存或规范化')
    if (publicSettings.site_author !== '测试作者' || publicSettings.banner_interval !== 3 || publicSettings.enable_rss !== false || publicSettings.show_visitor_stats !== false || publicSettings.allow_search_indexing !== false) throw new Error('新增公开站点设置解析错误')

    console.log('媒体自动分类、文件夹筛选与站点设置持久化测试通过')
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolve) => child.once('exit', resolve))
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
