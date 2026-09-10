import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { once } from 'node:events'
import { Response } from 'express'
import db from '../config/database'
import { config } from '../config'
import { AuthRequest } from '../middleware/auth'
import { error, success } from '../utils/response'

const DEFAULT_QUOTA = 15 * 1024 * 1024 * 1024
const DEFAULT_WARN_PERCENT = 80
const DEFAULT_CRITICAL_PERCENT = 90

type StorageCategory = 'album_originals' | 'album_previews' | 'resource' | 'other'
type PhysicalFile = { path: string; bytes: number; category: StorageCategory }

function settingNumber(key: string, fallback: number) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value?: string } | undefined
  const value = Number(row?.value)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function saveSetting(key: string, value: number, description: string) {
  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, type, description)
    VALUES (?, ?, 'number', ?)
  `).run(key, String(value), description)
}

function normalizeRelative(value: unknown) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/^uploads\//, '')
}

function* walkFiles(directory: string, prefix = ''): Generator<PhysicalFile> {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      yield* walkFiles(fullPath, relative)
      continue
    }
    if (!entry.isFile()) continue
    const bytes = fs.statSync(fullPath).size
    const category: StorageCategory = relative.startsWith('albums/originals/')
      ? 'album_originals'
      : relative.startsWith('albums/previews/')
        ? 'album_previews'
        : 'other'
    yield { path: relative, bytes, category }
  }
}

export function storageStats() {
  const mediaPaths = new Set(
    (db.prepare("SELECT path FROM media WHERE deleted_at IS NULL").all() as Array<{ path: string }>).map((row) => normalizeRelative(row.path)),
  )
  const categories: Record<StorageCategory, number> = { album_originals: 0, album_previews: 0, resource: 0, other: 0 }
  let usedBytes = 0
  let fileCount = 0
  for (const file of walkFiles(config.uploadDir)) {
    const category = file.category === 'other' && mediaPaths.has(file.path) ? 'resource' : file.category
    categories[category] += file.bytes
    usedBytes += file.bytes
    fileCount += 1
  }
  const quotaBytes = settingNumber('storage_quota_bytes', DEFAULT_QUOTA)
  const warnPercent = Math.min(99, Math.max(1, settingNumber('storage_warn_percent', DEFAULT_WARN_PERCENT)))
  const criticalPercent = Math.min(100, Math.max(warnPercent + 1, settingNumber('storage_critical_percent', DEFAULT_CRITICAL_PERCENT)))
  const percent = quotaBytes ? (usedBytes / quotaBytes) * 100 : 100
  const latestExport = db.prepare('SELECT * FROM album_export_records ORDER BY exported_at DESC LIMIT 1').get() as any
  return {
    quotaBytes,
    usedBytes,
    freeBytes: Math.max(0, quotaBytes - usedBytes),
    percent: Number(percent.toFixed(2)),
    warnPercent,
    criticalPercent,
    level: percent >= 100 ? 'full' : percent >= criticalPercent ? 'critical' : percent >= warnPercent ? 'warning' : 'normal',
    categories,
    fileCount,
    albumCount: Number((db.prepare('SELECT COUNT(*) AS count FROM albums WHERE is_active = 1').get() as any)?.count || 0),
    photoCount: Number((db.prepare('SELECT COUNT(*) AS count FROM album_photos').get() as any)?.count || 0),
    latestExport: latestExport ? {
      ...latestExport,
      album_ids: JSON.parse(latestExport.album_ids || '[]'),
      album_names: JSON.parse(latestExport.album_names || '[]'),
    } : null,
  }
}

export function stats(_req: AuthRequest, res: Response) {
  return success(res, storageStats())
}

export function updateSettings(req: AuthRequest, res: Response) {
  const quotaGb = Number(req.body?.quota_gb)
  const warnPercent = Number(req.body?.warn_percent)
  const criticalPercent = Number(req.body?.critical_percent)
  if (!Number.isFinite(quotaGb) || quotaGb < 1 || quotaGb > 1024) return error(res, '存储配额必须在 1GB 到 1024GB 之间')
  if (!Number.isInteger(warnPercent) || warnPercent < 1 || warnPercent > 98) return error(res, '普通告警阈值无效')
  if (!Number.isInteger(criticalPercent) || criticalPercent <= warnPercent || criticalPercent > 100) return error(res, '严重告警阈值必须高于普通告警阈值')
  saveSetting('storage_quota_bytes', Math.round(quotaGb * 1024 * 1024 * 1024), '全站资源存储配额（字节）')
  saveSetting('storage_warn_percent', warnPercent, '存储空间普通告警阈值')
  saveSetting('storage_critical_percent', criticalPercent, '存储空间严重告警阈值')
  return success(res, storageStats(), '存储设置已保存')
}

function safeName(value: unknown, fallback: string) {
  const name = String(value || fallback).trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').replace(/-+/g, '-').replace(/^[-. ]+|[-. ]+$/g, '').slice(0, 100)
  return name || fallback
}

function zipDate() {
  const now = new Date()
  return {
    time: now.getHours() << 11 | now.getMinutes() << 5 | Math.floor(now.getSeconds() / 2),
    date: (now.getFullYear() - 1980) << 9 | (now.getMonth() + 1) << 5 | now.getDate(),
  }
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index++) {
    let value = index
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

function crcUpdate(crc: number, chunk: Buffer) {
  let value = crc ^ 0xffffffff
  for (const byte of chunk) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

async function crcFile(filePath: string) {
  let value = 0xffffffff
  for await (const chunk of fs.createReadStream(filePath)) {
    for (const byte of Buffer.from(chunk)) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}

class ZipStream {
  private offset = 0
  private entries: Array<{ name: Buffer; crc: number; size: number; offset: number }> = []
  private archiveHash = crypto.createHash('sha256')

  constructor(private response: Response) {}

  private async write(chunk: Buffer) {
    this.archiveHash.update(chunk)
    this.offset += chunk.length
    if (!this.response.write(chunk)) await once(this.response, 'drain')
  }

  async addFile(name: string, filePath: string, bytes: number, crc: number) {
    const nameBuffer = Buffer.from(name)
    const date = zipDate()
    const header = Buffer.alloc(30 + nameBuffer.length)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0x800, 6)
    header.writeUInt16LE(0, 8)
    header.writeUInt16LE(date.time, 10)
    header.writeUInt16LE(date.date, 12)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(bytes, 18)
    header.writeUInt32LE(bytes, 22)
    header.writeUInt16LE(nameBuffer.length, 26)
    nameBuffer.copy(header, 30)
    const entryOffset = this.offset
    await this.write(header)
    for await (const chunk of fs.createReadStream(filePath)) await this.write(Buffer.from(chunk))
    this.entries.push({ name: nameBuffer, crc, size: bytes, offset: entryOffset })
  }

  async addBuffer(name: string, content: Buffer) {
    const nameBuffer = Buffer.from(name)
    const date = zipDate()
    const header = Buffer.alloc(30 + nameBuffer.length)
    const crc = crcUpdate(0, content)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0x800, 6)
    header.writeUInt16LE(0, 8)
    header.writeUInt16LE(date.time, 10)
    header.writeUInt16LE(date.date, 12)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(content.length, 18)
    header.writeUInt32LE(content.length, 22)
    header.writeUInt16LE(nameBuffer.length, 26)
    nameBuffer.copy(header, 30)
    const entryOffset = this.offset
    await this.write(header)
    await this.write(content)
    this.entries.push({ name: nameBuffer, crc, size: content.length, offset: entryOffset })
  }

  async finish() {
    const centralOffset = this.offset
    const date = zipDate()
    let centralSize = 0
    for (const entry of this.entries) {
      const header = Buffer.alloc(46 + entry.name.length)
      header.writeUInt32LE(0x02014b50, 0)
      header.writeUInt16LE(20, 4)
      header.writeUInt16LE(20, 6)
      header.writeUInt16LE(0x800, 8)
      header.writeUInt16LE(0, 10)
      header.writeUInt16LE(date.time, 12)
      header.writeUInt16LE(date.date, 14)
      header.writeUInt32LE(entry.crc, 16)
      header.writeUInt32LE(entry.size, 20)
      header.writeUInt32LE(entry.size, 24)
      header.writeUInt16LE(entry.name.length, 28)
      entry.name.copy(header, 46)
      centralSize += header.length
      await this.write(header)
    }
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(this.entries.length, 8)
    end.writeUInt16LE(this.entries.length, 10)
    end.writeUInt32LE(centralSize, 12)
    end.writeUInt32LE(centralOffset, 16)
    await this.write(end)
    return this.archiveHash.digest('hex')
  }
}

function parseIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))).slice(0, 100)
}

function exportAlbums(ids: number[]) {
  const placeholders = ids.map(() => '?').join(',')
  const albums = db.prepare(`SELECT id, title, description, event_date, location, latest_photo_at FROM albums WHERE id IN (${placeholders})`).all(...ids) as any[]
  const photos = db.prepare(`
    SELECT p.*, a.title AS album_title
    FROM album_photos p JOIN albums a ON a.id = p.album_id
    WHERE p.album_id IN (${placeholders})
    ORDER BY p.album_id, COALESCE(NULLIF(p.captured_at, ''), p.created_at) DESC, p.id DESC
  `).all(...ids) as any[]
  const albumMap = new Map(albums.map((album) => [Number(album.id), { ...album, photos: [] as any[] }]))
  photos.forEach((photo) => albumMap.get(Number(photo.album_id))?.photos.push(photo))
  return ids.map((id) => albumMap.get(id)).filter(Boolean) as any[]
}

export async function exportAlbumsZip(req: AuthRequest, res: Response) {
  const ids = parseIds(req.body?.album_ids)
  if (!ids.length) return error(res, '请选择至少一个完整相册')
  const albums = exportAlbums(ids)
  if (albums.length !== ids.length) return error(res, '部分相册不存在', 'NOT_FOUND', 404)
  const files: Array<{ album: any; photo: any; path: string; name: string; size: number; crc: number }> = []
  for (const album of albums) {
    for (const photo of album.photos) {
      const relative = normalizeRelative(photo.image).replace(/^uploads\//, '')
      const filePath = path.resolve(config.uploadDir, relative)
      if (!relative || !filePath.startsWith(path.resolve(config.uploadDir) + path.sep) || !fs.existsSync(filePath)) return error(res, `照片文件不存在：${photo.title || photo.image}`)
      const originalName = safeName(path.basename(photo.original_name || photo.title || relative, path.extname(photo.original_name || relative)), '图片')
      const ext = path.extname(photo.original_name || relative).toLowerCase() || '.jpg'
      const captured = String(photo.captured_at || photo.created_at || '').replace(/[-:TZ.]/g, '').slice(0, 14) || 'unknown'
      const base = safeName(`${album.title}-${captured}-${originalName}`, '图片')
      const name = `${safeName(album.title, '相册')}/${base}${ext}`
      const stat = fs.statSync(filePath)
      files.push({ album, photo, path: filePath, name, size: stat.size, crc: await crcFile(filePath) })
    }
  }
  const exportId = crypto.randomUUID()
  const albumNames = albums.map((album) => album.title)
  const manifest = Buffer.from(JSON.stringify({
    exported_at: new Date().toISOString(),
    albums: albums.map((album) => ({ id: album.id, title: album.title, latest_photo_at: album.latest_photo_at || album.event_date || album.created_at })),
    photos: files.map(({ album, photo, name, size }) => ({ id: photo.id, album_id: album.id, album: album.title, original_name: photo.original_name || photo.title || '', exported_name: name, captured_at: photo.captured_at || photo.created_at || '', size })),
  }, null, 2))
  db.prepare('DELETE FROM album_export_records').run()
  db.prepare(`INSERT INTO album_export_records (id, album_ids, album_names, photo_count, total_bytes) VALUES (?, ?, ?, ?, ?)`).run(
    exportId,
    JSON.stringify(ids),
    JSON.stringify(albumNames),
    files.length,
    files.reduce((sum, file) => sum + file.size, 0),
  )
  const filename = `相册原图-${new Date().toISOString().slice(0, 10)}.zip`
  res.status(200)
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
  const zip = new ZipStream(res)
  let finished = false
  res.once('finish', () => { finished = true })
  try {
    await zip.addBuffer('manifest.json', manifest)
    for (const file of files) await zip.addFile(file.name, file.path, file.size, file.crc)
    const checksum = await zip.finish()
    db.prepare('UPDATE album_export_records SET checksum = ? WHERE id = ?').run(checksum, exportId)
    res.end()
  } catch (cause) {
    if (!finished) res.destroy(cause instanceof Error ? cause : undefined)
  }
}

function removeIfUnreferenced(relative: string, albumIds: number[]) {
  const normalized = normalizeRelative(relative)
  if (!normalized) return 0
  const albumPlaceholders = albumIds.map(() => '?').join(',')
  const uploadPath = `/uploads/${normalized}`
  const albumRef = db.prepare(`SELECT 1 FROM album_photos WHERE (image = ? OR image = ? OR preview_image = ? OR preview_image = ?) AND album_id NOT IN (${albumPlaceholders}) LIMIT 1`).get(uploadPath, normalized, uploadPath, normalized, ...albumIds)
  const mediaRef = db.prepare('SELECT 1 FROM media WHERE (path = ? OR path = ?) AND deleted_at IS NULL LIMIT 1').get(normalized, uploadPath)
  if (albumRef || mediaRef) return 0
  const fullPath = path.resolve(config.uploadDir, normalized)
  if (!fullPath.startsWith(path.resolve(config.uploadDir) + path.sep) || !fs.existsSync(fullPath)) return 0
  const size = fs.statSync(fullPath).size
  fs.rmSync(fullPath, { force: true })
  return size
}

export function cleanupExport(req: AuthRequest, res: Response) {
  const id = String(req.body?.export_id || '')
  const record = db.prepare('SELECT * FROM album_export_records WHERE id = ?').get(id) as any
  if (!record) return error(res, '没有可清理的导出记录', 'NOT_FOUND', 404)
  if (record.cleaned_at) return error(res, '这次导出已经清理过了')
  let ids: number[]
  try { ids = parseIds(JSON.parse(record.album_ids || '[]')) } catch { ids = [] }
  if (!ids.length) return error(res, '导出记录无效')
  const placeholders = ids.map(() => '?').join(',')
  const photos = db.prepare(`SELECT image, preview_image FROM album_photos WHERE album_id IN (${placeholders})`).all(...ids) as any[]
  let releasedBytes = 0
  const clean = db.transaction(() => {
    photos.forEach((photo) => {
      releasedBytes += removeIfUnreferenced(photo.image, ids)
      releasedBytes += removeIfUnreferenced(photo.preview_image, ids)
    })
    db.prepare(`DELETE FROM albums WHERE id IN (${placeholders})`).run(...ids)
    db.prepare('UPDATE album_export_records SET cleaned_at = datetime(\'now\'), released_bytes = ? WHERE id = ?').run(releasedBytes, id)
  })
  clean()
  return success(res, { releasedBytes, storage: storageStats() }, '完整相册已清理')
}
