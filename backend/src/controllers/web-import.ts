import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { spawn } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs/promises'
import sharp from 'sharp'
import sanitize from 'sanitize-html'
import * as cheerio from 'cheerio'
import Turndown from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import db from '../config/database'
import { config } from '../config'
import { fetchWeb, webUrl } from '../services/web-fetch'
import { saveArticleSources } from '../services/article-sources'
import { renderArticleContent } from '../utils/markdown'
import { success, error } from '../utils/response'
import { extractWithReadability } from '../services/readability-extractor'
import { canonicalArticleUrl, prepareArticleHtml, WebArticleError } from '../services/web-article'
import { renderWebArticle } from '../services/web-renderer'

type Picture = { id: string; url: string; alt: string }
type Preview = { owner: number; expires: number; title: string; html: string; source: any; images: Picture[]; busy?: boolean; result?: any }
const previews = new Map<string, Preview>()
let extracting = 0
let committing = 0

async function extractWithTrafilatura(html: string, url: string): Promise<any> {
  const python = process.env.WEB_IMPORT_PYTHON || path.resolve(__dirname, '../../.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
  return new Promise((resolve, reject) => {
    const child = spawn(python, [path.resolve(__dirname, '../../scripts/extract-web.py')], { windowsHide: true, stdio: ['pipe','pipe','pipe'] })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    let output = '', errors = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error('正文提取超时，请换一个链接重试')) }, 25000)
    child.stdout.on('data', chunk => { output += chunk.toString(); if (output.length > 4_000_000) { child.kill(); reject(new Error('正文过大')) } })
    child.stderr.on('data', chunk => { errors = (errors + chunk.toString()).slice(-2000) })
    child.stdin.on('error', () => {})
    child.on('error', () => { clearTimeout(timer); reject(new Error('网页导入引擎尚未安装，请按部署文档安装 Trafilatura')) })
    child.on('close', code => {
      clearTimeout(timer)
      if (code !== 0) return reject(new Error(errors.includes('ModuleNotFoundError') ? '网页导入引擎依赖缺失，请重新安装' : '未能提取正文；网页可能需要登录、浏览器渲染或限制抓取'))
      try { resolve({ ...JSON.parse(output), engine: 'trafilatura' }) } catch { reject(new Error('正文提取返回了无效结果')) }
    })
    child.stdin.end(JSON.stringify({ html, url }))
  })
}

export async function extractWebHtml(html: string, url: string): Promise<any> {
  try {
    return await extractWithTrafilatura(html, url)
  } catch {
    // npm installs this engine with the backend, so a missing Python environment
    // never disables webpage import. Both paths use the same fetch/sanitizer.
    return extractWithReadability(html, url)
  }
}

async function extractArticleDocument(html: string, url: string, assisted = false) {
  const prepared = prepareArticleHtml(html, url, assisted)
  const extracted = await extractWebHtml(prepared.html, url)
  // A site's exact article container is already scoped: preserve its image order
  // and short paragraphs, which generic heuristics may otherwise discard.
  if (prepared.scoped) extracted.html = cheerio.load(prepared.html)('article').html() || extracted.html
  if (cleanExtractedHtml(extracted.html, url).text.length < 80) throw new WebArticleError('未找到完整正文，请使用“粘贴图文”导入', 'DYNAMIC_EMPTY')
  return extracted
}

export async function extractArticleFromUrl(sourceUrl: string) {
  let finalUrl = sourceUrl
  try {
    const response = await fetchWeb(sourceUrl)
    finalUrl = canonicalArticleUrl(response.url)
    if (!/text\/html|application\/xhtml\+xml/i.test(response.type)) throw new WebArticleError('该链接不是 HTML 网页，请使用本地文件导入', 'NOT_HTML')
    const charset = response.type.match(/charset=["']?([\w-]+)/i)?.[1] || response.bytes.toString('ascii',0,2048).match(/charset=["']?([\w-]+)/i)?.[1] || 'utf-8'
    let html: string
    try { html = new TextDecoder(charset).decode(response.bytes) } catch { html = response.bytes.toString('utf8') }
    return {extracted: await extractArticleDocument(html, finalUrl), url: finalUrl, method: 'http'}
  } catch (cause) {
    if (cause instanceof WebArticleError && cause.code === 'NOT_HTML') throw cause
  }
  const rendered = await renderWebArticle(finalUrl)
  return {extracted: await extractArticleDocument(rendered.html, rendered.url), url: rendered.url, method: 'browser'}
}

export function cleanExtractedHtml(html: string, base: string) {
  const $ = cheerio.load(sanitize(html, {
    allowedTags: ['h1','h2','h3','h4','h5','h6','p','div','section','article','br','hr','strong','b','em','i','s','del','blockquote','pre','code','ul','ol','li','table','thead','tbody','tr','th','td','a','img'],
    allowedAttributes: { a: ['href'], img: ['src','alt'], th: ['colspan','rowspan'], td: ['colspan','rowspan'] },
    allowedSchemes: ['http','https'], allowProtocolRelative: true,
  }))
  const images: Picture[] = []
  $('a').each((_, node) => {
    try { $(node).attr('href', webUrl(new URL($(node).attr('href') || '', base).href).href) }
    catch { $(node).replaceWith($(node).contents()) }
  })
  $('img').each((_, node) => {
    try {
      if (images.length >= 30) { $(node).remove(); return }
      const url = webUrl(new URL($(node).attr('src') || '', base).href).href
      const picture = { id: String(images.length + 1), url, alt: ($(node).attr('alt') || '').slice(0, 200) }
      images.push(picture)
      $(node).attr('src', `https://boke-import.invalid/image/${picture.id}`)
    } catch { $(node).remove() }
  })
  return { html: $('body').html() || '', images, text: $('body').text().replace(/\s+/g, ' ').trim() }
}
function duplicates(source: any) {
  return db.prepare(`SELECT DISTINCT a.id,a.title,a.status FROM articles a JOIN article_web_sources s ON s.article_id=a.id
    WHERE a.deleted_at IS NULL AND (s.source_url=? OR s.final_url=? OR s.fingerprint=?) LIMIT 10`)
    .all(source.source_url, source.final_url, source.fingerprint)
}
function owned(req: AuthRequest): Preview | undefined {
  const item = previews.get(String(req.body.preview_id || ''))
  return item && item.owner === req.userId && item.expires > Date.now() ? item : undefined
}
export async function preview(req: AuthRequest, res: Response) {
  if (extracting >= 2) return error(res, '正在提取其他网页，请稍后重试', 'BUSY', 429)
  for (const [key, value] of previews) if (value.expires < Date.now()) previews.delete(key)
  if (previews.size >= 40) return error(res, '预览数量已达上限，请稍后重试', 'BUSY', 429)
  extracting++
  try {
    const sourceUrl = webUrl(String(req.body.url || '')).href
    const supplied = req.body.html
    if (supplied !== undefined && (typeof supplied !== 'string' || Buffer.byteLength(supplied) > 6 * 1024 * 1024)) throw new Error('粘贴内容须为 HTML 文本，且不能超过 6 MB')
    const response = supplied !== undefined
      ? {extracted: await extractArticleDocument(supplied, sourceUrl, true), url: canonicalArticleUrl(sourceUrl), method: 'clipboard'}
      : await extractArticleFromUrl(sourceUrl)
    const extracted = response.extracted
    const cleaned = cleanExtractedHtml(extracted.html, response.url)
    if (cleaned.text.length < 30) throw new Error('未找到足够的正文内容，请确认链接是文章详情页')
    const title = String((supplied !== undefined && req.body.title) || extracted.title || new URL(response.url).hostname).slice(0,300)
    const source = { source_url: sourceUrl, final_url: response.url, title, author: String(extracted.author || ''), published_at: String(extracted.date || ''), fetched_at: new Date().toISOString(), fingerprint: createHash('sha256').update(cleaned.text).digest('hex') }
    const id = randomUUID()
    previews.set(id, { owner: req.userId!, expires: Date.now() + 15 * 60_000, title, html: cleaned.html, images: cleaned.images, source })
    // No third-party image request is made by the preview browser.
    const $ = cheerio.load(cleaned.html)
    $('img').each((_, node) => { $(node).replaceWith($('<p>').text(`[图片 ${$(node).attr('src')?.split('/').pop()}] ${$(node).attr('alt') || ''}`)) })
    return success(res, { preview_id: id, title, html: $('body').html(), source, images: cleaned.images, duplicates: duplicates(source), characters: cleaned.text.length, method: response.method, engine: extracted.engine })
  } catch (cause) { return error(res, cause instanceof Error ? cause.message : '网页提取失败', cause instanceof WebArticleError ? cause.code : 'EXTRACTION_FAILED') }
  finally { extracting-- }
}
export async function commit(req: AuthRequest, res: Response) {
  const item = owned(req)
  if (!item) return error(res, '预览已过期，请重新提取', 'PREVIEW_EXPIRED', 410)
  if (item.result) return success(res, item.result)
  if (item.busy || committing >= 2) return error(res, '正在处理导入，请稍候', 'BUSY', 429)
  if (!['draft','insert'].includes(req.body.mode)) return error(res, '请选择导入方式')
  if (duplicates(item.source).length && !req.body.allow_duplicate) return error(res, '发现已导入的文章，请确认是否仍要导入', 'DUPLICATE', 409)
  const title = String(req.body.title || item.title).trim().slice(0,300)
  if (!title) return error(res, '请填写标题')
  item.busy = true; committing++
  const created: string[] = []
  try {
    const selected = new Set(Array.isArray(req.body.image_ids) ? req.body.image_ids.map(String) : [])
    const $ = cheerio.load(item.html)
    const media: { filename: string; original: string; relative: string; size: number }[] = []
    let total = 0
    for (const picture of item.images) {
      const node = $(`img[src="https://boke-import.invalid/image/${picture.id}"]`)
      if (!selected.has(picture.id)) { node.remove(); continue }
      const downloaded = await fetchWeb(picture.url, 8 * 1024 * 1024)
      total += downloaded.bytes.length
      if (total > 32 * 1024 * 1024) throw new Error('所选图片超过 32 MB，请减少图片数量')
      if (!/^image\//i.test(downloaded.type)) throw new Error(`图片 ${picture.id} 不是可用的图片，请取消勾选后重试`)
      const bytes = await sharp(downloaded.bytes, { limitInputPixels: 40_000_000 }).rotate().webp({quality: 90}).toBuffer()
      const filename = `${randomUUID()}.webp`
      const relative = `web-import/${new Date().toISOString().slice(0,7)}/${filename}`
      const target = path.join(config.uploadDir, relative)
      await fs.mkdir(path.dirname(target), {recursive: true})
      await fs.writeFile(target, bytes, {flag: 'wx'}); created.push(target)
      media.push({ filename, original: (picture.alt || `网页图片-${picture.id}`) + '.webp', relative, size: bytes.length })
      node.attr('src', `/uploads/${relative}`)
    }
    if (req.body.keep_links === false) $('a').each((_, node) => { $(node).replaceWith($(node).contents()) })
    const converter = new Turndown({ headingStyle: 'atx', codeBlockStyle: 'fenced' }); converter.use(gfm)
    const citationTitle = item.source.title.replace(/[\[\]\\\n\r]/g, ' ')
    const content = converter.turndown($('body').html() || '') + `\n\n---\n\n> 来源：[${citationTitle}](<${item.source.final_url}>)\n`
    const result = db.transaction(() => {
      for (const file of media) db.prepare('INSERT INTO media (filename,original_name,path,mime_type,size) VALUES (?,?,?,?,?)').run(file.filename,file.original,file.relative,'image/webp',file.size)
      if (req.body.mode === 'insert') return { content, web_sources: [item.source], images_imported: media.length }
      const row = db.prepare(`INSERT INTO articles (title,slug,content,content_html,excerpt,status,visibility,author_id) VALUES (?,?,?,?,?,'draft','public',?)`)
        .run(title, `web-${randomUUID()}`, content, renderArticleContent(content), '', req.userId!)
      const id = Number(row.lastInsertRowid)
      saveArticleSources(id, [item.source])
      return { id, images_imported: media.length }
    })()
    item.result = result
    return success(res, result, '导入完成')
  } catch (cause) {
    await Promise.all(created.map(file => fs.unlink(file).catch(() => {})))
    return error(res, cause instanceof Error ? cause.message : '导入失败', 'IMPORT_FAILED')
  } finally { item.busy = false; committing-- }
}
