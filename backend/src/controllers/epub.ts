import { Response } from 'express'
import AdmZip from 'adm-zip'
import { XMLParser } from 'fast-xml-parser'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import posixPath from 'path/posix'
import { config } from '../config'
import { AuthRequest } from '../middleware/auth'
import { error, success } from '../utils/response'

const MAX_ENTRIES = 2500
const MAX_UNCOMPRESSED_SIZE = 220 * 1024 * 1024
const MAX_CHAPTERS = 800
const IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
])

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  textNodeName: '#text',
  parseTagValue: false,
  trimValues: false,
})

type ManifestItem = {
  id: string
  href: string
  mediaType: string
  properties: string
  fullPath: string
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function textValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (Array.isArray(value)) return value.map(textValue).find(Boolean) || ''
  if (typeof value === 'object') return textValue((value as Record<string, unknown>)['#text'])
  return ''
}

function stripTags(value: unknown): string {
  return textValue(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function safeZipPath(value: string): string {
  const normalized = posixPath.normalize(String(value || '').replace(/\\/g, '/')).replace(/^\.\//, '')
  if (!normalized || normalized === '..' || normalized.startsWith('../') || normalized.startsWith('/')) {
    throw new Error('EPUB 中包含不安全的文件路径')
  }
  return normalized
}

function resolveBookPath(baseFile: string, relativePath: string): string {
  const clean = decodeURIComponent(String(relativePath || '').split('#')[0].split('?')[0])
  return safeZipPath(posixPath.join(posixPath.dirname(baseFile), clean))
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char] || char))
}

function extractBody(xhtml: string): string {
  const body = xhtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? xhtml
  return body
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|form|button|textarea|select)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(?:embed|input|link|meta|base)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:srcdoc|formaction)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+((?:xlink:)?href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"')
    .trim()
}

function extractChapterTitle(xhtml: string, fallback: string): string {
  for (const pattern of [/<h1\b[^>]*>([\s\S]*?)<\/h1>/i, /<h2\b[^>]*>([\s\S]*?)<\/h2>/i, /<title\b[^>]*>([\s\S]*?)<\/title>/i]) {
    const value = stripTags(xhtml.match(pattern)?.[1])
    if (value) return value.slice(0, 160)
  }
  return fallback.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || '未命名章节'
}

function collectNcxPoints(value: any, map: Map<string, string>, ncxPath: string) {
  for (const point of asArray(value)) {
    const src = String(point?.content?.src || '')
    const label = stripTags(point?.navLabel?.text)
    if (src && label) map.set(resolveBookPath(ncxPath, src), label.slice(0, 160))
    collectNcxPoints(point?.navPoint, map, ncxPath)
  }
}

function parseToc(zip: AdmZip, manifest: ManifestItem[], opf: any): Map<string, string> {
  const titles = new Map<string, string>()
  const navItem = manifest.find((item) => item.properties.split(/\s+/).includes('nav'))
  if (navItem) {
    const entry = zip.getEntry(navItem.fullPath)
    const source = entry?.getData().toString('utf8') || ''
    const navBlock = source.match(/<nav\b[^>]*(?:epub:type\s*=\s*["']toc["']|role\s*=\s*["']doc-toc["'])[^>]*>([\s\S]*?)<\/nav>/i)?.[1] || source
    const linkRe = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    let match: RegExpExecArray | null
    while ((match = linkRe.exec(navBlock))) {
      const label = stripTags(match[2])
      if (label) titles.set(resolveBookPath(navItem.fullPath, match[1]), label.slice(0, 160))
    }
  }

  const spineTocId = String(opf?.package?.spine?.toc || '')
  const ncxItem = manifest.find((item) => item.id === spineTocId || item.mediaType === 'application/x-dtbncx+xml')
  if (ncxItem) {
    const entry = zip.getEntry(ncxItem.fullPath)
    if (entry) {
      const ncx = xmlParser.parse(entry.getData().toString('utf8'))
      collectNcxPoints(ncx?.ncx?.navMap?.navPoint, titles, ncxItem.fullPath)
    }
  }
  return titles
}

function createAssetDirectory() {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const token = crypto.randomBytes(6).toString('hex')
  const relative = `${year}/${month}/epub-${token}`
  const absolute = path.join(config.uploadDir, ...relative.split('/'))
  fs.mkdirSync(absolute, { recursive: true })
  return { relative, absolute }
}

export function importEpub(req: AuthRequest, res: Response) {
  if (!req.file?.buffer) return error(res, '请选择 EPUB 文件', 'EPUB_REQUIRED', 400)
  if (!/\.epub$/i.test(req.file.originalname)) return error(res, '只支持 .epub 文件', 'EPUB_TYPE_INVALID', 400)

  let assetDirectory: ReturnType<typeof createAssetDirectory> | null = null
  try {
    const zip = new AdmZip(req.file.buffer)
    const entries = zip.getEntries()
    if (!entries.length || entries.length > MAX_ENTRIES) throw new Error('EPUB 文件条目数量异常')
    const totalSize = entries.reduce((sum, entry) => sum + Number(entry.header.size || 0), 0)
    if (totalSize > MAX_UNCOMPRESSED_SIZE) throw new Error('EPUB 解压后体积过大')

    const containerEntry = zip.getEntry('META-INF/container.xml')
    if (!containerEntry) throw new Error('EPUB 缺少 META-INF/container.xml')
    const container = xmlParser.parse(containerEntry.getData().toString('utf8'))
    const opfPath = safeZipPath(String(asArray(container?.container?.rootfiles?.rootfile)[0]?.['full-path'] || ''))
    const opfEntry = zip.getEntry(opfPath)
    if (!opfEntry) throw new Error('EPUB 无法找到内容清单')
    const opf = xmlParser.parse(opfEntry.getData().toString('utf8'))
    const pkg = opf?.package
    if (!pkg?.manifest || !pkg?.spine) throw new Error('EPUB 内容清单格式无效')

    const manifest = asArray(pkg.manifest.item).map((item: any): ManifestItem => ({
      id: String(item?.id || ''),
      href: String(item?.href || ''),
      mediaType: String(item?.['media-type'] || ''),
      properties: String(item?.properties || ''),
      fullPath: resolveBookPath(opfPath, String(item?.href || '')),
    })).filter((item) => item.id && item.href)
    const manifestById = new Map(manifest.map((item) => [item.id, item]))
    const spine = asArray(pkg.spine.itemref)
      .map((item: any) => manifestById.get(String(item?.idref || '')))
      .filter((item): item is ManifestItem => Boolean(item))
      .slice(0, MAX_CHAPTERS)
    if (!spine.length) throw new Error('EPUB 没有可阅读章节')

    assetDirectory = createAssetDirectory()
    const assetUrls = new Map<string, string>()
    for (const item of manifest) {
      const ext = IMAGE_TYPES.get(item.mediaType.toLowerCase())
      if (!ext) continue
      const entry = zip.getEntry(item.fullPath)
      if (!entry || entry.isDirectory) continue
      const buffer = entry.getData()
      if (!buffer.length || buffer.length > 25 * 1024 * 1024) continue
      const filename = `${crypto.createHash('sha1').update(item.fullPath).digest('hex').slice(0, 16)}${ext}`
      fs.writeFileSync(path.join(assetDirectory.absolute, filename), buffer)
      assetUrls.set(item.fullPath, `/uploads/${assetDirectory.relative}/${filename}`)
    }

    const metadata = pkg.metadata || {}
    const title = stripTags(metadata.title) || req.file.originalname.replace(/\.epub$/i, '')
    const author = stripTags(metadata.creator)
    const description = stripTags(metadata.description)
    const tocTitles = parseToc(zip, manifest, opf)
    const coverId = asArray(metadata.meta).find((item: any) => String(item?.name || '').toLowerCase() === 'cover')?.content
    const coverItem = manifest.find((item) => item.id === String(coverId || '') || item.properties.split(/\s+/).includes('cover-image'))
    const cover = coverItem ? assetUrls.get(coverItem.fullPath) || '' : ''

    const chapters: Array<{ title: string; html: string }> = []
    for (const [index, item] of spine.entries()) {
      const entry = zip.getEntry(item.fullPath)
      if (!entry || entry.isDirectory) continue
      const source = entry.getData().toString('utf8')
      let body = extractBody(source)
      if (!body) continue
      body = body.replace(/\b(src|href)\s*=\s*(["'])([^"']+)\2/gi, (full, attribute, quote, target) => {
        if (/^(?:https?:|mailto:|tel:|data:|#)/i.test(target)) return full
        try {
          const resolved = resolveBookPath(item.fullPath, target)
          const assetUrl = assetUrls.get(resolved)
          if (assetUrl) return `${attribute}=${quote}${assetUrl}${quote}`
          if (attribute.toLowerCase() === 'href' && target.includes('#')) return `${attribute}=${quote}#${quote}`
        } catch {
          // Invalid relative links are removed below.
        }
        return attribute.toLowerCase() === 'src' ? '' : `${attribute}=${quote}#${quote}`
      })
      const chapterTitle = tocTitles.get(item.fullPath) || extractChapterTitle(source, posixPath.basename(item.href))
      const duplicateHeading = new RegExp(`^\\s*<h[12]\\b[^>]*>\\s*${chapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<\\/h[12]>`, 'i')
      body = body.replace(duplicateHeading, '').trim()
      chapters.push({ title: chapterTitle || `第 ${index + 1} 章`, html: body })
    }
    if (!chapters.length) throw new Error('EPUB 章节正文为空')

    const content = [
      '<!-- boke:epub-novel -->',
      chapters.map((chapter, index) => [
        `<section class="epub-chapter" data-epub-chapter="${index + 1}">`,
        `<h2>${escapeHtml(chapter.title)}</h2>`,
        chapter.html,
        '</section>',
      ].join('\n')).join('\n\n'),
    ].join('\n')
    if (Buffer.byteLength(content, 'utf8') > 9 * 1024 * 1024) {
      throw new Error('EPUB 正文超过 9MB，请拆分为多卷后分别导入')
    }
    const excerpt = [author ? `作者：${author}` : '', description].filter(Boolean).join(' · ').slice(0, 500)
    return success(res, {
      title: title.slice(0, 200),
      author,
      excerpt,
      cover_image: cover,
      content,
      chapter_count: chapters.length,
      chapters: chapters.map((chapter, index) => ({ index: index + 1, title: chapter.title })),
    }, `EPUB 已解析，共 ${chapters.length} 章`)
  } catch (cause) {
    if (assetDirectory) fs.rmSync(assetDirectory.absolute, { recursive: true, force: true })
    const message = cause instanceof Error ? cause.message : 'EPUB 解析失败'
    return error(res, message, 'EPUB_IMPORT_FAILED', 400)
  }
}
