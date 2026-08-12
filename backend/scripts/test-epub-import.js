const AdmZip = require('adm-zip')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const port = 31991
const origin = `http://127.0.0.1:${port}`
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'boke-epub-test-'))
const uploadDir = path.join(tempRoot, 'uploads')

function makeEpub() {
  const zip = new AdmZip()
  zip.addFile('mimetype', Buffer.from('application/epub+zip'))
  zip.addFile('META-INF/container.xml', Buffer.from(`<?xml version="1.0"?>
    <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
      <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
    </container>`))
  zip.addFile('OEBPS/content.opf', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:identifier id="book-id">boke-test</dc:identifier>
        <dc:title>测试小说 第一卷</dc:title>
        <dc:creator>测试作者</dc:creator>
        <dc:description>这是用于验证 EPUB 导入的简介。</dc:description>
      </metadata>
      <manifest>
        <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        <item id="cover" href="images/cover.png" media-type="image/png" properties="cover-image"/>
        <item id="illustration" href="images/scene.png" media-type="image/png"/>
        <item id="chapter-1" href="text/chapter-1.xhtml" media-type="application/xhtml+xml"/>
        <item id="chapter-2" href="text/chapter-2.xhtml" media-type="application/xhtml+xml"/>
      </manifest>
      <spine><itemref idref="chapter-1"/><itemref idref="chapter-2"/></spine>
    </package>`))
  zip.addFile('OEBPS/nav.xhtml', Buffer.from(`<html xmlns="http://www.w3.org/1999/xhtml"><body>
    <nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol>
      <li><a href="text/chapter-1.xhtml">序章</a></li>
      <li><a href="text/chapter-2.xhtml">第一章 相遇</a></li>
    </ol></nav></body></html>`))
  zip.addFile('OEBPS/text/chapter-1.xhtml', Buffer.from(`<html xmlns="http://www.w3.org/1999/xhtml"><head><title>序章</title></head>
    <body><h1>序章</h1><p>这是第一段小说正文。</p><img src="../images/scene.png" alt="插图"/></body></html>`))
  zip.addFile('OEBPS/text/chapter-2.xhtml', Buffer.from(`<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第一章 相遇</title></head>
    <body><h1>第一章 相遇</h1><p>这是第二段小说正文。</p></body></html>`))
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  zip.addFile('OEBPS/images/cover.png', png)
  zip.addFile('OEBPS/images/scene.png', png)
  return zip.toBuffer()
}

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
      JWT_SECRET: 'epub-test-secret-at-least-thirty-two-characters',
      ADMIN_PASSWORD: 'epub-test-password',
      DB_PATH: path.join(tempRoot, 'blog.db'),
      UPLOAD_DIR: uploadDir,
      CORS_ORIGIN: origin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    await waitForServer(child)
    const loginResponse = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'epub-test-password' }),
    })
    const login = await loginResponse.json()
    if (!loginResponse.ok || !login.data?.token) throw new Error(`登录失败：${JSON.stringify(login)}`)

    const form = new FormData()
    form.append('file', new Blob([makeEpub()], { type: 'application/epub+zip' }), 'test-volume.epub')
    const response = await fetch(`${origin}/api/admin/articles/epub/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.data.token}` },
      body: form,
    })
    const json = await response.json()
    if (!response.ok || !json.success) throw new Error(`导入失败：${JSON.stringify(json)}`)
    const book = json.data
    const checks = {
      title: book.title === '测试小说 第一卷',
      author: book.author === '测试作者',
      chapters: book.chapter_count === 2 && book.chapters?.[1]?.title === '第一章 相遇',
      marker: book.content.includes('<!-- boke:epub-novel -->'),
      body: book.content.includes('这是第一段小说正文') && book.content.includes('这是第二段小说正文'),
      cover: /^\/uploads\/.+\.png$/.test(book.cover_image),
      illustration: /<img[^>]+src=["']\/uploads\/.+\.png["']/.test(book.content),
    }
    if (Object.values(checks).some((value) => !value)) throw new Error(`校验失败：${JSON.stringify(checks)}\n${JSON.stringify(book)}`)

    const authHeaders = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
    const seriesResponse = await fetch(`${origin}/api/admin/series`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title: '测试小说', description: '两卷组成一本书', status: 'published' }),
    })
    const seriesJson = await seriesResponse.json()
    if (!seriesResponse.ok || !seriesJson.data?.id) throw new Error(`专题创建失败：${JSON.stringify(seriesJson)}`)

    const articleResponse = await fetch(`${origin}/api/admin/articles`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: book.title,
        content: book.content,
        excerpt: book.excerpt,
        cover_image: book.cover_image,
        status: 'published',
        visibility: 'public',
        series_id: seriesJson.data.id,
        series_order: 1,
      }),
    })
    const articleJson = await articleResponse.json()
    if (!articleResponse.ok || !articleJson.data?.slug) throw new Error(`文章创建失败：${JSON.stringify(articleJson)}`)

    const publicArticleResponse = await fetch(`${origin}/api/articles/${encodeURIComponent(articleJson.data.slug)}`)
    const publicArticleJson = await publicArticleResponse.json()
    const publicSeriesResponse = await fetch(`${origin}/api/series/${encodeURIComponent(seriesJson.data.slug)}`)
    const publicSeriesJson = await publicSeriesResponse.json()
    const publishingChecks = {
      article_public: publicArticleResponse.ok && publicArticleJson.data?.series_position === 1,
      rendered_sections: publicArticleJson.data?.content_html?.includes('class="epub-chapter"') && publicArticleJson.data?.content_html?.includes('<h2>序章</h2>'),
      novel_series: publicSeriesResponse.ok && publicSeriesJson.data?.is_novel === true,
      volume_order: publicSeriesJson.data?.articles?.length === 1 && publicSeriesJson.data.articles[0].series_order === 1,
    }
    if (Object.values(publishingChecks).some((value) => !value)) {
      throw new Error(`发布链路校验失败：${JSON.stringify(publishingChecks)}\n${JSON.stringify(publicArticleJson)}\n${JSON.stringify(publicSeriesJson)}`)
    }
    console.log(JSON.stringify({ success: true, checks, publishingChecks, chapter_count: book.chapter_count }, null, 2))
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolve) => setTimeout(resolve, 250))
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
