import { Response } from 'express'
import crypto from 'crypto'
import path from 'path'
import db from '../config/database'
import { config } from '../config'
import { AuthRequest } from '../middleware/auth'
import { renderMarkdown } from '../utils/markdown'
import { success, error } from '../utils/response'

type TextChapter = { title: string; html: string }
type TextPreview = { title: string; format: string; chapters: TextChapter[]; createdAt: number }
const previews = new Map<string, TextPreview>()

function clean(value: unknown, max = 500) { return String(value ?? '').trim().slice(0, max) }
function slugify(value: string, fallback = 'book') {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || fallback
}
function unique(table: 'books'|'book_volumes'|'book_chapters', raw: string, parent?: number) {
  const base = slugify(raw), sql = table === 'books' ? 'SELECT 1 FROM books WHERE slug=?' : table === 'book_volumes' ? 'SELECT 1 FROM book_volumes WHERE book_id=? AND slug=?' : 'SELECT 1 FROM book_chapters WHERE volume_id=? AND slug=?'
  let value = base, index = 2
  while (parent == null ? db.prepare(sql).get(value) : db.prepare(sql).get(parent, value)) value = `${base}-${index++}`
  return value
}
function decode(buffer: Buffer) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  if ((utf8.match(/�/g) || []).length <= Math.max(2, utf8.length / 500)) return utf8.replace(/^\uFEFF/, '')
  try { return new TextDecoder('gb18030').decode(buffer).replace(/^\uFEFF/, '') } catch { return utf8 }
}
function splitText(source: string, markdown: boolean): TextChapter[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const heading = markdown ? /^#{1,3}\s+(.{1,120})\s*$/ : /^\s*((?:第\s*[0-9一二三四五六七八九十百千万零〇两]+\s*[章节卷回部篇]|chapter\s+\d+|prologue|epilogue).{0,100})\s*$/i
  const groups: Array<{title:string; lines:string[]}> = []
  let current = { title: '正文', lines: [] as string[] }
  for (const line of lines) {
    const match = line.match(heading)
    if (match && current.lines.some((item) => item.trim())) {
      groups.push(current)
      current = { title: clean(match[1], 160) || `章节 ${groups.length + 1}`, lines: markdown ? [line] : [] }
    } else if (match && !current.lines.some((item) => item.trim())) {
      current.title = clean(match[1], 160) || current.title
      if (markdown) current.lines.push(line)
    } else current.lines.push(line)
  }
  if (current.lines.some((item) => item.trim())) groups.push(current)
  if (groups.length <= 1 && source.length > 50000) {
    const paragraphs = source.split(/\n\s*\n/), chunks: string[][] = [[]]
    for (const paragraph of paragraphs) {
      const active = chunks[chunks.length - 1]
      if (active.join('\n\n').length > 24000) chunks.push([])
      chunks[chunks.length - 1].push(paragraph)
    }
    return chunks.map((chunk, index) => ({ title: `第 ${index + 1} 节`, html: renderMarkdown(chunk.join('\n\n')) }))
  }
  return groups.map((group) => ({ title: group.title, html: renderMarkdown(group.lines.join('\n').trim()) })).filter((item) => item.html.trim())
}

export function previewTextBooks(req: AuthRequest, res: Response) {
  const files = (req.files as Express.Multer.File[] || [])
  if (!files.length) return error(res, '请选择 TXT 或 Markdown 文件', 'BOOK_FILE_REQUIRED', 400)
  const chapters = files.flatMap((file) => splitText(decode(file.buffer), /\.(?:md|markdown)$/i.test(file.originalname)))
  if (!chapters.length) return error(res, '文件中没有可导入的正文', 'BOOK_TEXT_EMPTY', 400)
  const first = files[0].originalname.replace(/\.(?:txt|md|markdown)$/i, '')
  const token = crypto.randomBytes(18).toString('base64url')
  const format = files.every((file) => /\.(?:md|markdown)$/i.test(file.originalname)) ? 'markdown' : 'txt'
  previews.set(token, { title: first, format, chapters, createdAt: Date.now() })
  return success(res, { token, title: first, author: '', format, volumes: [{ index: 0, title: files.length > 1 ? '合并正文' : '正文', chapter_count: chapters.length, chapters: chapters.map((chapter, index) => ({ index, title: chapter.title })) }] }, '文本书籍预览已生成')
}

export function commitTextBooks(req: AuthRequest, res: Response) {
  const preview = previews.get(clean(req.body?.token, 200))
  if (!preview || Date.now() - preview.createdAt > 30 * 60 * 1000) return error(res, '预览已过期，请重新选择文件', 'BOOK_PREVIEW_EXPIRED', 410)
  const title = clean(req.body?.title || preview.title, 200)
  if (!title) return error(res, '书名不能为空', 'VALIDATION_ERROR')
  const enabled = Array.isArray(req.body?.volumes) ? req.body.volumes[0] : null
  const selected = Array.isArray(enabled?.chapters) ? new Set(enabled.chapters.map(Number)) : null
  const chapters = selected ? preview.chapters.filter((_, index) => selected.has(index)) : preview.chapters
  if (!chapters.length) return error(res, '至少保留一个章节', 'EMPTY_IMPORT', 400)
  const result = db.transaction(() => {
    const slug = unique('books', req.body?.slug || title)
    const inserted = db.prepare("INSERT INTO books (title,slug,author,status,reading_mode,source_format) VALUES (?,?,?,'published','chapters',?)")
      .run(title, slug, clean(req.body?.author, 160), preview.format)
    const bookId = Number(inserted.lastInsertRowid)
    const volumeTitle = clean(enabled?.title, 160) || '正文'
    const volume = db.prepare('INSERT INTO book_volumes (book_id,title,slug,sort_order,source_filename) VALUES (?,?,?,?,?)')
      .run(bookId, volumeTitle, unique('book_volumes', volumeTitle, bookId), 0, `${preview.title}.${preview.format === 'markdown' ? 'md' : 'txt'}`)
    const volumeId = Number(volume.lastInsertRowid)
    chapters.forEach((chapter, index) => db.prepare('INSERT INTO book_chapters (volume_id,title,slug,content_html,sort_order,source_key) VALUES (?,?,?,?,?,?)')
      .run(volumeId, chapter.title, unique('book_chapters', chapter.title, volumeId), chapter.html, index, `${preview.format}#${index}`))
    return { book_id: bookId, slug, volume_count: 1, chapter_count: chapters.length }
  })()
  previews.delete(clean(req.body?.token, 200))
  return success(res, result, '文本书籍已导入')
}

export function importPdf(req: AuthRequest, res: Response) {
  if (!req.file || !/\.pdf$/i.test(req.file.originalname)) return error(res, '请选择 PDF 文件', 'PDF_REQUIRED', 400)
  const title = clean(req.body?.title || req.file.originalname.replace(/\.pdf$/i, ''), 200)
  const relative = path.relative(config.uploadDir, req.file.path).split(path.sep).join('/')
  const readingUrl = `/uploads/${relative}`
  const slug = unique('books', req.body?.slug || title)
  const inserted = db.prepare("INSERT INTO books (title,slug,author,description,cover,status,reading_mode,reading_url,source_format) VALUES (?,?,?,?,?,'published','document',?,'pdf')")
    .run(title, slug, clean(req.body?.author, 160), clean(req.body?.description, 4000), clean(req.body?.cover, 500), readingUrl)
  return success(res, { id: Number(inserted.lastInsertRowid), slug, reading_url: readingUrl }, 'PDF 已加入书库')
}