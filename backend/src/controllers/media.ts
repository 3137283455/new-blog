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
  folder_id?: number | null
}

function isFontFile(media: Partial<MediaLike>) {
  const mime = String(media.mime_type || '').toLowerCase()
  const name = String(media.original_name || media.path || '').split('?')[0].toLowerCase()
  return mime.startsWith('font/') || mime === 'application/vnd.ms-fontobject' || /\.(woff2?|ttf|otf|eot)$/i.test(name)
}

function mediaCategory(media: Partial<MediaLike>) {
  const mime = String(media.mime_type || '').toLowerCase()
  const name = `${media.original_name || ''} ${media.path || ''}`.toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (isFontFile(media)) return 'font'
  if (mime.startsWith('text/') || /pdf|json|xml|word|excel|spreadsheet|presentation|epub|zip|rar|7z/.test(mime) || /\.(pdf|txt|md|json|xml|csv|docx?|xlsx?|pptx?|epub|zip|rar|7z)(\?|$)/i.test(name)) return 'document'
  return 'other'
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
    bangumi_play_sources: '追番播放源',
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
    ['bangumi_play_sources', '追番播放源', ['url', 'remark'], 'name'],
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
type MediaFolder = { id: number; name: string; parent_id: number | null; created_at?: string; updated_at?: string }
const smartMediaTypes = new Set(['image', 'video', 'audio', 'font', 'document', 'other'])
function parseFolderId(value: unknown) {
  if (value === undefined || value === null || value === '' || value === 'root') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error('Invalid folder')
  return parsed
}
function getFolder(id: number | null) {
  return id === null ? null : db.prepare('SELECT * FROM media_folders WHERE id = ?').get(id) as MediaFolder | undefined
}
function requireFolder(id: number | null) {
  const folder = getFolder(id)
  if (id !== null && !folder) throw new Error('Folder not found')
  return folder
}
function cleanEntryName(value: unknown, maxLength = 120) {
  const name = String(value || '').trim()
  if (!name) throw new Error('Name is required')
  if (name === '.' || name === '..' || /[\\/:*?"<>|]/.test(name)) throw new Error('Name contains invalid characters')
  return name.slice(0, maxLength)
}
function folderExistsByName(name: string, parentId: number | null, excludeId = 0) {
  return !!db.prepare('SELECT 1 FROM media_folders WHERE parent_id IS ? AND lower(name) = lower(?) AND id != ? LIMIT 1').get(parentId, name, excludeId)
}
function allMediaFolders() {
  return db.prepare('SELECT * FROM media_folders ORDER BY lower(name), id').all() as MediaFolder[]
}
function folderBreadcrumb(folderId: number | null) {
  const chain: MediaFolder[] = []
  const visited = new Set<number>()
  let currentId = folderId
  while (currentId !== null && !visited.has(currentId) && chain.length < 30) {
    visited.add(currentId)
    const folder = getFolder(currentId)
    if (!folder) break
    chain.unshift(folder)
    currentId = folder.parent_id
  }
  return chain
}
function serializeExplorerMedia(item: any) {
  return { ...item, url: `/uploads/${item.path}`, category: mediaCategory(item) }
}
function mediaCounts(rows: MediaLike[]) {
  const counts: Record<string, number> = { all: rows.length, image: 0, video: 0, audio: 0, font: 0, document: 0, other: 0 }
  rows.forEach((item) => { counts[mediaCategory(item)] += 1 })
  return counts
}
function compareExplorerItems(sort: string, order: string) {
  const direction = order === 'desc' ? -1 : 1
  return (left: any, right: any) => {
    const value = (item: any): string | number => sort === 'size' ? Number(item.size || 0)
      : sort === 'date' ? String(item.created_at || '')
        : sort === 'type' ? mediaCategory(item)
          : String(item.original_name || item.name || '').toLocaleLowerCase()
    const a = value(left)
    const b = value(right)
    return (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'zh-CN')) * direction
  }
}
export function explorer(req: AuthRequest, res: Response) {
  try {
    const folderId = parseFolderId(req.query.folderId)
    const type = String(req.query.type || '')
    const trashed = String(req.query.trashed || '') === 'true'
    const search = String(req.query.search || '').trim().toLocaleLowerCase()
    const sort = ['name', 'type', 'size', 'date'].includes(String(req.query.sort)) ? String(req.query.sort) : 'name'
    const order = String(req.query.order) === 'desc' ? 'desc' : 'asc'
    if (type && !smartMediaTypes.has(type)) return error(res, 'Invalid media type')
    if (!type && !trashed) requireFolder(folderId)
    const rows = db.prepare(`SELECT * FROM media WHERE deleted_at IS ${trashed ? 'NOT ' : ''}NULL`).all() as any[]
    const files = rows.filter((item) => !type || mediaCategory(item) === type)
      .filter((item) => type || trashed || (folderId === null ? item.folder_id == null : Number(item.folder_id) === folderId))
      .filter((item) => !search || `${item.original_name || ''} ${item.mime_type || ''} ${item.path || ''}`.toLocaleLowerCase().includes(search))
      .sort(compareExplorerItems(sort, order)).slice(0, 1000).map(serializeExplorerMedia)
    const folders = (!type && !trashed ? allMediaFolders().filter((folder) => folder.parent_id === folderId)
      .filter((folder) => !search || folder.name.toLocaleLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') * (order === 'desc' ? -1 : 1)) : [])
    return success(res, { folders, files, all_folders: allMediaFolders(), breadcrumb: type || trashed ? [] : folderBreadcrumb(folderId), counts: mediaCounts(rows), total: folders.length + files.length })
  } catch (cause: any) { return error(res, cause?.message || 'Unable to load media explorer') }
}
export function createFolder(req: AuthRequest, res: Response) {
  try {
    const name = cleanEntryName(req.body?.name, 80)
    const parentId = parseFolderId(req.body?.parent_id)
    requireFolder(parentId)
    if (folderExistsByName(name, parentId)) return error(res, 'A folder with this name already exists')
    const result = db.prepare('INSERT INTO media_folders (name, parent_id) VALUES (?, ?)').run(name, parentId)
    return success(res, db.prepare('SELECT * FROM media_folders WHERE id = ?').get(result.lastInsertRowid), 'Folder created')
  } catch (cause: any) { return error(res, cause?.message || 'Unable to create folder') }
}
function folderMoveCreatesCycle(folderId: number, parentId: number | null) {
  let current = parentId
  const visited = new Set<number>()
  while (current !== null && !visited.has(current)) {
    if (current === folderId) return true
    visited.add(current)
    current = getFolder(current)?.parent_id ?? null
  }
  return false
}
export function updateFolder(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id)
    const folder = getFolder(id)
    if (!folder) return error(res, 'Folder not found', 'NOT_FOUND', 404)
    const name = req.body?.name === undefined ? folder.name : cleanEntryName(req.body.name, 80)
    const parentId = req.body?.parent_id === undefined ? folder.parent_id : parseFolderId(req.body.parent_id)
    requireFolder(parentId)
    if (folderMoveCreatesCycle(id, parentId)) return error(res, 'Cannot move a folder into itself or its descendant')
    if (folderExistsByName(name, parentId, id)) return error(res, 'A folder with this name already exists')
    db.prepare("UPDATE media_folders SET name = ?, parent_id = ?, updated_at = datetime('now') WHERE id = ?").run(name, parentId, id)
    return success(res, db.prepare('SELECT * FROM media_folders WHERE id = ?').get(id), 'Folder updated')
  } catch (cause: any) { return error(res, cause?.message || 'Unable to update folder') }
}
export function removeFolder(req: AuthRequest, res: Response) {
  const id = Number(req.params.id)
  if (!getFolder(id)) return error(res, 'Folder not found', 'NOT_FOUND', 404)
  const occupied = db.prepare('SELECT 1 FROM media_folders WHERE parent_id = ? LIMIT 1').get(id) || db.prepare('SELECT 1 FROM media WHERE folder_id = ? LIMIT 1').get(id)
  if (occupied) return error(res, 'Folder is not empty')
  db.prepare('DELETE FROM media_folders WHERE id = ?').run(id)
  return success(res, null, 'Folder deleted')
}
const generatedMimeTypes: Record<string, string> = { '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json', '.csv': 'text/csv' }
export function createFile(req: AuthRequest, res: Response) {
  try {
    let name = cleanEntryName(req.body?.name)
    if (!path.extname(name)) name += '.txt'
    const extension = path.extname(name).toLowerCase()
    if (!generatedMimeTypes[extension]) return error(res, 'Supported types: txt, md, json, csv')
    const folderId = parseFolderId(req.body?.folder_id)
    requireFolder(folderId)
    const content = String(req.body?.content || '')
    if (Buffer.byteLength(content) > 1024 * 1024) return error(res, 'File content is too large')
    const directory = new Date().toISOString().slice(0, 10).replace(/-/g, '/')
    fs.mkdirSync(path.join(config.uploadDir, directory), { recursive: true })
    const filename = `created-${Date.now()}-${Math.random().toString(36).slice(2, 9)}${extension}`
    const relativePath = `${directory}/${filename}`
    fs.writeFileSync(path.join(config.uploadDir, relativePath), content, 'utf8')
    const result = db.prepare('INSERT INTO media (filename, original_name, path, mime_type, size, folder_id) VALUES (?, ?, ?, ?, ?, ?)').run(filename, name, relativePath, generatedMimeTypes[extension], Buffer.byteLength(content), folderId)
    return success(res, serializeExplorerMedia(db.prepare('SELECT * FROM media WHERE id = ?').get(result.lastInsertRowid)), 'File created')
  } catch (cause: any) { return error(res, cause?.message || 'Unable to create file') }
}
export function updateMedia(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id)
    const media = db.prepare('SELECT * FROM media WHERE id = ?').get(id) as any
    if (!media) return error(res, 'File not found', 'NOT_FOUND', 404)
    const name = req.body?.name === undefined ? media.original_name : cleanEntryName(req.body.name)
    const folderId = req.body?.folder_id === undefined ? (media.folder_id ?? null) : parseFolderId(req.body.folder_id)
    requireFolder(folderId)
    db.prepare('UPDATE media SET original_name = ?, folder_id = ? WHERE id = ?').run(name, folderId, id)
    return success(res, serializeExplorerMedia(db.prepare('SELECT * FROM media WHERE id = ?').get(id)), 'File updated')
  } catch (cause: any) { return error(res, cause?.message || 'Unable to update file') }
}

export function list(req: AuthRequest, res: Response) {
  const page = Number(req.query.page as string) || 1
  const pageSize = Number(req.query.pageSize as string) || 20
  const type = req.query.type as string
  const trashed = String(req.query.trashed || '') === 'true'

  const where = trashed ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'
  const allMedia = (db.prepare(`SELECT * FROM media WHERE ${where} ORDER BY created_at DESC`).all() as any[])
    .filter((item) => !type || mediaCategory(item) === type)
  const media = allMedia
    .slice((page - 1) * pageSize, page * pageSize)
    .map((item: any) => {
      const referenceDetails = mediaReferenceDetails(item)
      const references = referenceDetails.map((ref) => ref.type)
      return {
        ...item,
        url: `/uploads/${item.path}`,
        category: mediaCategory(item),
        in_use: references.length > 0,
        references,
        reference_details: referenceDetails,
      }
    })
  return success(res, media, '获取成功', paginationResult(page, pageSize, allMedia.length))
}

export function folders(req: AuthRequest, res: Response) {
  const trashed = String(req.query.trashed || '') === 'true'
  const rows = db.prepare(`SELECT mime_type, original_name, path FROM media WHERE deleted_at IS ${trashed ? 'NOT ' : ''}NULL`).all() as MediaLike[]
  const counts: Record<string, number> = { all: rows.length, image: 0, video: 0, audio: 0, font: 0, document: 0, other: 0 }
  rows.forEach((item) => { counts[mediaCategory(item)] += 1 })
  return success(res, counts)
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

  let folderId: number | null = null
  try {
    folderId = parseFolderId(req.body?.folder_id)
    requireFolder(folderId)
  } catch (cause: any) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
    return error(res, cause?.message || 'Folder not found')
  }

  const result = db.prepare(`
    INSERT INTO media (filename, original_name, path, mime_type, size, folder_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(file.filename, originalName, relativePath, file.mimetype, file.size, folderId)

  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(result.lastInsertRowid) as any
  if (media) {
    media.url = `/uploads/${media.path}`
    media.category = mediaCategory(media)
  }
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
