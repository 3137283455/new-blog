import { Response } from 'express'
import path from 'path'
import fs from 'fs'
import db from '../config/database'
import { config } from '../config'
import { success, error, paginationResult } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

type MediaLike = {
  id: number
  filename?: string
  original_name?: string
  path: string
  mime_type?: string
  created_at?: string
}

function isFontFile(media: Partial<MediaLike>) {
  const value = `${media.mime_type || ''} ${media.original_name || ''} ${media.path || ''}`.toLowerCase()
  return value.includes('font') || /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(value)
}

function normalizeOriginalName(name: string) {
  const decoded = Buffer.from(name, 'latin1').toString('utf8')
  return decoded.includes('�') ? name : decoded
}

function mediaNeedles(media: MediaLike) {
  const pathValue = media.path.replace(/\\/g, '/')
  const encodedPath = pathValue.split('/').map(encodeURIComponent).join('/')
  return Array.from(new Set([
    pathValue,
    `/uploads/${pathValue}`,
    encodedPath,
    `/uploads/${encodedPath}`,
    media.filename || '',
  ].filter(Boolean)))
}

const tableExistsCache = new Map<string, boolean>()
const tableColumnsCache = new Map<string, string[]>()

function tableExists(table: string) {
  if (!tableExistsCache.has(table)) {
    tableExistsCache.set(table, !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table))
  }
  return tableExistsCache.get(table) || false
}

function tableColumns(table: string) {
  if (!tableExists(table)) return []
  if (!tableColumnsCache.has(table)) {
    tableColumnsCache.set(
      table,
      (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).map((column) => String(column.name)),
    )
  }
  return tableColumnsCache.get(table) || []
}

function hasReference(table: string, columns: string[], needles: string[]) {
  if (!tableExists(table)) return false
  const clauses = columns.flatMap((column) => needles.map(() => `${column} LIKE ?`))
  const params = columns.flatMap(() => needles.map((needle) => `%${needle}%`))
  if (!clauses.length) return false
  return !!db.prepare(`SELECT 1 FROM ${table} WHERE ${clauses.join(' OR ')} LIMIT 1`).get(...params)
}

function referenceRows(table: string, columns: string[], needles: string[], labelColumn = 'title') {
  if (!tableExists(table)) return []
  const available = new Set(tableColumns(table))
  const searchableColumns = columns.filter((column) => available.has(column))
  const clauses = searchableColumns.flatMap((column) => needles.map(() => `${column} LIKE ?`))
  const params = searchableColumns.flatMap(() => needles.map((needle) => `%${needle}%`))
  if (!clauses.length) return []
  const labelCandidates = labelColumn === 'username'
    ? ['nickname', 'username']
    : [labelColumn, 'title', 'name', 'slug', 'filename', 'key']
  const labelFields = labelCandidates.filter((field) => available.has(field))
  const labelExpr = labelFields.length ? `COALESCE(${labelFields.join(', ')}, id)` : 'id'
  return db.prepare(`SELECT id, ${labelExpr} AS label FROM ${table} WHERE ${clauses.join(' OR ')} LIMIT 12`).all(...params) as any[]
}

function mediaReferenceDetails(media: MediaLike) {
  const needles = mediaNeedles(media)
  const referenceTypeLabels: Record<string, string> = {
    articles: '文章',
    pages: '独立页面',
    settings: '站点设置',
    users: '个人资料',
    navigation_links: '导航',
    bangumi_items: '追番',
    albums: '相册',
    album_photos: '相册照片',
    music_playlists: '歌单',
    music_tracks: '音乐',
    themes: '主题',
    plugins: '插件',
  }
  const references: Array<[string, string, string[], string]> = [
    ['articles', '文章', ['content', 'content_html', 'excerpt', 'cover_image', 'title_font_url', 'body_font_url'], 'title'],
    ['pages', '独立页面', ['content', 'content_html'], 'title'],
    ['settings', '站点设置', ['value'], 'key'],
    ['users', '个人资料', ['avatar'], 'username'],
    ['navigation_links', '导航', ['icon', 'avatar', 'description'], 'title'],
    ['bangumi_items', '追番', ['cover', 'summary'], 'title'],
    ['albums', '相册', ['cover', 'description'], 'title'],
    ['album_photos', '相册照片', ['image', 'description'], 'title'],
    ['music_playlists', '歌单', ['cover', 'description'], 'name'],
    ['music_tracks', '音乐', ['url', 'cover', 'lyrics'], 'title'],
    ['themes', '主题', ['screenshot', 'config'], 'name'],
    ['plugins', '插件', ['config'], 'name'],
  ]

  return references
    .map(([table, legacyType, columns, labelColumn]) => {
      const type = referenceTypeLabels[table] || legacyType
      const items = referenceRows(table, columns, needles, labelColumn)
      return items.length ? { type, items: items.map((item) => ({ id: item.id, label: item.label || `${type} #${item.id}` })) } : null
    })
    .filter(Boolean) as Array<{ type: string; items: Array<{ id: number; label: string }> }>
}

function mediaReferences(media: MediaLike) {
  return mediaReferenceDetails(media).map((item) => item.type)
}

function isMediaReferenced(media: MediaLike) {
  return mediaReferences(media).length > 0
}

function isRecentUpload(media: MediaLike, graceHours = 1) {
  if (!media.created_at) return false
  const createdAt = new Date(String(media.created_at).replace(' ', 'T') + 'Z').getTime()
  if (!Number.isFinite(createdAt)) return false
  return Date.now() - createdAt < graceHours * 60 * 60 * 1000
}

export function list(req: AuthRequest, res: Response) {
  const page = Number(req.query.page as string) || 1
  const pageSize = Number(req.query.pageSize as string) || 20
  const type = req.query.type as string
  const trashed = String(req.query.trashed || '') === 'true'

  let where = trashed ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'
  const params: any[] = []
  if (type === 'font') {
    where += ` AND (
      mime_type LIKE 'font/%'
      OR mime_type LIKE 'application/font-%'
      OR mime_type LIKE 'application/x-font-%'
      OR mime_type = 'application/vnd.ms-fontobject'
      OR path LIKE '%.woff'
      OR path LIKE '%.woff2'
      OR path LIKE '%.ttf'
      OR path LIKE '%.otf'
      OR path LIKE '%.eot'
    )`
  } else if (type) {
    where += ' AND mime_type LIKE ?'
    params.push(`${type}/%`)
  }

  const media = db.prepare(`SELECT * FROM media WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize)
    .map((item: any) => {
      const referenceDetails = mediaReferenceDetails(item)
      const references = referenceDetails.map((ref) => ref.type)
      return {
        ...item,
        url: `/uploads/${item.path}`,
        in_use: references.length > 0,
        references,
        reference_details: referenceDetails,
      }
    })
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM media WHERE ${where}`).get(...params) as any

  return success(res, media, '获取成功', paginationResult(page, pageSize, total))
}

export function upload(req: AuthRequest, res: Response) {
  if (!req.file) return error(res, '请选择文件')
  const file = req.file
  const relativePath = path.relative(config.uploadDir, file.path).replace(/\\/g, '/')
  const originalName = normalizeOriginalName(file.originalname)
  const fontFile = isFontFile({ mime_type: file.mimetype, original_name: originalName, path: relativePath })
  const maxSize = fontFile ? config.maxFontFileSize : config.maxFileSize

  if (file.size > maxSize) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
    const mb = Math.round(maxSize / 1024 / 1024)
    return error(res, `文件过大，当前类型最大允许 ${mb}MB`, 'FILE_TOO_LARGE', 413)
  }

  const result = db.prepare(`
    INSERT INTO media (filename, original_name, path, mime_type, size)
    VALUES (?, ?, ?, ?, ?)
  `).run(file.filename, originalName, relativePath, file.mimetype, file.size)

  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(result.lastInsertRowid) as any
  if (media) media.url = `/uploads/${media.path}`
  return success(res, media, '上传成功')
}

export function remove(req: AuthRequest, res: Response) {
  const { id } = req.params
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(id)) as any
  if (!media) return error(res, '文件不存在', 'NOT_FOUND', 404)

  db.prepare("UPDATE media SET deleted_at = datetime('now') WHERE id = ?").run(Number(id))
  return success(res, null, '文件已移入回收站')
}

export function restore(req: AuthRequest, res: Response) {
  const { id } = req.params
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(id)) as any
  if (!media) return error(res, '文件不存在', 'NOT_FOUND', 404)

  db.prepare('UPDATE media SET deleted_at = NULL WHERE id = ?').run(Number(id))
  return success(res, null, '文件已恢复')
}

export function forceDelete(req: AuthRequest, res: Response) {
  const { id } = req.params
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(id)) as any
  if (!media) return error(res, '文件不存在', 'NOT_FOUND', 404)

  const references = mediaReferences(media)
  if (references.length > 0) {
    return error(res, '文件仍被内容引用，不能永久删除', 'MEDIA_IN_USE', 400)
  }

  const filePath = path.join(config.uploadDir, media.path)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  db.prepare('DELETE FROM media WHERE id = ?').run(Number(id))
  return success(res, null, '文件已永久删除')
}

export function cleanup(_req: AuthRequest, res: Response) {
  const mediaFiles = db.prepare('SELECT * FROM media WHERE deleted_at IS NULL').all() as MediaLike[]
  let movedCount = 0
  let keptCount = 0
  let recentCount = 0
  const movedFiles: string[] = []
  const keptFiles: Array<{ name: string; references: string[] }> = []
  const recentFiles: string[] = []

  for (const media of mediaFiles) {
    const references = mediaReferences(media)
    if (references.length > 0) {
      keptCount++
      if (keptFiles.length < 20) keptFiles.push({ name: media.original_name || media.filename || media.path, references })
      continue
    }
    if (isRecentUpload(media)) {
      recentCount++
      if (recentFiles.length < 20) recentFiles.push(media.original_name || media.filename || media.path)
      continue
    }

    db.prepare("UPDATE media SET deleted_at = datetime('now') WHERE id = ?").run(media.id)
    movedCount++
    if (movedFiles.length < 20) movedFiles.push(media.original_name || media.filename || media.path)
  }

  return success(
    res,
    { moved: movedCount, kept: keptCount, recent: recentCount, movedFiles, keptFiles, recentFiles },
    `清理完成，共移动 ${movedCount} 个冗余文件到媒体回收站，保留 ${keptCount} 个正在使用的文件，跳过 ${recentCount} 个新上传文件`,
  )
}
