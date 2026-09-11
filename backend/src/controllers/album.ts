import { Response } from 'express'
import crypto from 'node:crypto'
import db from '../config/database'
import { success, error } from '../utils/response'
import { AuthRequest } from '../middleware/auth'
import { DeviceRequest } from '../middleware/device'
import { config } from '../config'
import path from 'path'
import fs from 'fs'
import * as exifr from 'exifr'
import sharp from 'sharp'
import { storageStats } from './storage'
import { publicRelations } from '../services/content-relations'

const albumSelect = `
  SELECT a.id, a.title, a.description,
         COALESCE(NULLIF(a.cover, ''), (SELECT COALESCE(NULLIF(p.preview_image, ''), p.image) FROM album_photos p WHERE p.album_id = a.id ORDER BY COALESCE(NULLIF(p.captured_at, ''), p.created_at) DESC, p.id DESC LIMIT 1), '') AS cover,
         a.event_date, a.location, a.icon, a.story_mode, a.sort_order,
         a.is_active, a.latest_photo_at,
         COALESCE(NULLIF(a.latest_photo_at, ''), NULLIF(a.event_date, ''), a.created_at) AS album_time,
         a.created_at, a.updated_at
  FROM albums a
`

function attachPhotos(albums: any[]) {
  if (!albums.length) return albums
  const ids = albums.map((album) => album.id)
  const placeholders = ids.map(() => '?').join(',')
  const photos = db.prepare(`
    SELECT id, album_id, title, image, description, variant, sort_order,
      original_name, display_name, preview_image, file_hash, file_size, mime_type,
      width, height, captured_at, camera, photo_location, story_text, created_at, updated_at
    FROM album_photos
    WHERE album_id IN (${placeholders})
    ORDER BY COALESCE(NULLIF(captured_at, ''), created_at) DESC, id DESC
  `).all(...ids) as any[]
  const grouped = new Map<number, any[]>()
  photos.forEach((photo) => {
    const list = grouped.get(photo.album_id) || []
    list.push(photo)
    grouped.set(photo.album_id, list)
  })
  return albums.map((album) => ({ ...album, photos: grouped.get(album.id) || [] }))
}

const LIMITS = {
  title: 100,
  url: 500,
  description: 500,
  location: 120,
  icon: 40,
  date: 30,
  variant: 20,
  sortOrderMin: -9999,
  sortOrderMax: 9999,
}

const allowedVariants = new Set(['1x1', '4x3', '3x4', '16x9', '9x16', 'wide', 'tall'])

function cleanText(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function cleanSortOrder(value: unknown) {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(LIMITS.sortOrderMin, Math.min(LIMITS.sortOrderMax, Math.trunc(parsed)))
}

function cleanVariant(value: unknown) {
  const variant = cleanText(value, LIMITS.variant) || '1x1'
  return allowedVariants.has(variant) ? variant : '1x1'
}

export function publicList(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`${albumSelect} WHERE a.is_active = 1 ORDER BY album_time DESC, a.id DESC`).all() as any[]
  return success(res, attachPhotos(rows))
}

export function publicDetail(req: AuthRequest, res: Response) {
  const album = db.prepare(`${albumSelect} WHERE a.id = ? AND a.is_active = 1`).get(Number(req.params.id)) as any
  if (!album) return error(res, '相册不存在', 'NOT_FOUND', 404)
  const result = attachPhotos([album])[0]
  return success(res, { ...result, custom_relations: publicRelations('album', album.id) })
}

export function list(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`${albumSelect} ORDER BY album_time DESC, a.id DESC`).all() as any[]
  return success(res, attachPhotos(rows))
}

export function create(req: AuthRequest, res: Response) {
  const { title, description, cover, event_date, location, icon, story_mode, sort_order, is_active } = req.body
  const safeTitle = cleanText(title, LIMITS.title)
  if (!safeTitle) return error(res, '相册标题不能为空')
  db.prepare(`
    INSERT INTO albums (title, description, cover, event_date, location, icon, story_mode, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    safeTitle,
    cleanText(description, LIMITS.description),
    cleanText(cover, LIMITS.url),
    cleanText(event_date, LIMITS.date),
    cleanText(location, LIMITS.location),
    cleanText(icon, LIMITS.icon),
    story_mode ? 1 : 0,
    cleanSortOrder(sort_order),
    is_active === false ? 0 : 1,
  )
  return success(res, null, '相册已创建')
}

export function update(req: AuthRequest, res: Response) {
  const { title, description, cover, event_date, location, icon, story_mode, sort_order, is_active } = req.body
  if (title !== undefined && !cleanText(title, LIMITS.title)) return error(res, '相册标题不能为空')
  const result = db.prepare(`
    UPDATE albums
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        cover = COALESCE(?, cover),
        event_date = COALESCE(?, event_date),
        location = COALESCE(?, location),
        icon = COALESCE(?, icon),
        story_mode = COALESCE(?, story_mode),
        sort_order = COALESCE(?, sort_order),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title === undefined ? null : cleanText(title, LIMITS.title),
    description === undefined ? null : cleanText(description, LIMITS.description),
    cover === undefined ? null : cleanText(cover, LIMITS.url),
    event_date === undefined ? null : cleanText(event_date, LIMITS.date),
    location === undefined ? null : cleanText(location, LIMITS.location),
    icon === undefined ? null : cleanText(icon, LIMITS.icon),
    story_mode === undefined ? null : (story_mode ? 1 : 0),
    sort_order === undefined ? null : cleanSortOrder(sort_order),
    is_active === undefined ? null : (is_active ? 1 : 0),
    Number(req.params.id),
  )
  if (result.changes === 0) return error(res, '相册不存在', 'NOT_FOUND', 404)
  return success(res, null, '相册已更新')
}

export function remove(req: AuthRequest, res: Response) {
  const result = db.prepare('DELETE FROM albums WHERE id = ?').run(Number(req.params.id))
  if (result.changes === 0) return error(res, '相册不存在', 'NOT_FOUND', 404)
  return success(res, null, '相册已删除')
}

async function readPhotoMetadata(image: string) {
  if (!image.startsWith('/uploads/')) return {}
  const relative = image.replace(/^\/uploads\//, '').replace(/[/\\]+/g, path.sep)
  const filePath = path.resolve(config.uploadDir, relative)
  if (!filePath.startsWith(path.resolve(config.uploadDir) + path.sep) || !fs.existsSync(filePath)) return {}
  try {
    const metadata: any = await exifr.parse(filePath, ['DateTimeOriginal', 'CreateDate', 'Make', 'Model', 'latitude', 'longitude'])
    const captured = metadata?.DateTimeOriginal || metadata?.CreateDate
    const capturedAt = captured instanceof Date ? captured.toISOString() : cleanText(captured, 40)
    const camera = [metadata?.Make, metadata?.Model].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    const photoLocation = Number.isFinite(metadata?.latitude) && Number.isFinite(metadata?.longitude)
      ? `${Number(metadata.latitude).toFixed(6)}, ${Number(metadata.longitude).toFixed(6)}`
      : ''
    return { capturedAt, camera, photoLocation }
  } catch {
    return {}
  }
}

function safeFilePart(value: unknown, fallback: string) {
  const cleaned = String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/^[-. ]+|[-. ]+$/g, '')
    .slice(0, 100)
  return cleaned || fallback
}

function photoExtension(file: Express.Multer.File) {
  const ext = path.extname(file.originalname).toLowerCase()
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif'].includes(ext)) return ext
  const byMime: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/heic': '.heic',
    'image/heif': '.heif',
  }
  return byMime[file.mimetype] || '.jpg'
}

function normalizePhotoTime(value: unknown, fallback = new Date().toISOString()) {
  const text = String(value || '').trim()
  const timestamp = text ? Date.parse(text) : NaN
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback
}

function normalizeUploadPath(value: unknown) {
  return String(value || '').replace(/^\/?uploads\//, '').replace(/^\/+/, '')
}

function photoNameTime(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'unknown'
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}${String(date.getUTCSeconds()).padStart(2, '0')}`
}

async function readPhotoMetadataBuffer(image: Buffer) {
  try {
    const metadata: any = await exifr.parse(image, ['DateTimeOriginal', 'CreateDate', 'Make', 'Model', 'latitude', 'longitude'])
    const captured = metadata?.DateTimeOriginal || metadata?.CreateDate
    return {
      capturedAt: captured instanceof Date ? captured.toISOString() : String(captured || '').trim(),
      camera: [metadata?.Make, metadata?.Model].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
      width: Number(metadata?.ImageWidth || metadata?.ExifImageWidth || 0) || 0,
      height: Number(metadata?.ImageHeight || metadata?.ExifImageHeight || 0) || 0,
    }
  } catch {
    return { capturedAt: '', camera: '', width: 0, height: 0 }
  }
}

function updateAlbumTime(albumId: number) {
  db.prepare(`
    UPDATE albums
    SET latest_photo_at = COALESCE((
      SELECT MAX(COALESCE(NULLIF(captured_at, ''), created_at))
      FROM album_photos WHERE album_id = ?
    ), ''), updated_at = datetime('now')
    WHERE id = ?
  `).run(albumId, albumId)
}

function albumById(id: unknown) {
  return db.prepare(`${albumSelect} WHERE a.id = ?`).get(Number(id)) as any
}

function serializePhoto(photo: any) {
  return {
    ...photo,
    title: photo.title || photo.display_name || photo.original_name || '无题照片',
    display_name: photo.display_name || photo.title || photo.original_name || '图片',
    preview_image: photo.preview_image || photo.image,
  }
}

async function storeDevicePhoto(album: any, file: Express.Multer.File, body: any, deviceId?: number) {
  if (!file.buffer?.length) throw new Error('图片内容为空')
  const currentStorage = storageStats()
  if (currentStorage.freeBytes < file.buffer.length) throw new Error('剩余存储空间不足，请联系管理员')
  const metadata = await readPhotoMetadataBuffer(file.buffer)
  const capturedAt = normalizePhotoTime(body?.captured_at || metadata.capturedAt)
  const originalName = String(file.originalname || '剪贴板图片').trim().slice(0, 180)
  const originalBase = path.parse(originalName).name || '图片'
  const title = safeFilePart(body?.title, safeFilePart(originalBase, '图片'))
  const hash = crypto.createHash('sha256').update(file.buffer).digest('hex')
  const existing = db.prepare('SELECT image, preview_image, width, height FROM album_photos WHERE file_hash = ? LIMIT 1').get(hash) as any
  const extension = photoExtension(file)
  const now = new Date()
  const directory = `albums/originals/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
  const relativeImage = `${directory}/${hash}${extension}`
  const absoluteImage = path.join(config.uploadDir, ...relativeImage.split('/'))
  let image = existing?.image || `/uploads/${relativeImage}`
  if (!fs.existsSync(path.resolve(config.uploadDir, normalizeUploadPath(image)))) {
    fs.mkdirSync(path.dirname(absoluteImage), { recursive: true })
    fs.writeFileSync(absoluteImage, file.buffer)
    image = `/uploads/${relativeImage}`
  }
  let previewImage = existing?.preview_image || ''
  if (!previewImage) {
    const previewRelative = `albums/previews/${hash}.webp`
    const previewAbsolute = path.join(config.uploadDir, ...previewRelative.split('/'))
    try {
      fs.mkdirSync(path.dirname(previewAbsolute), { recursive: true })
      const preview = await sharp(file.buffer, { animated: true })
        .rotate()
        .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer()
      fs.writeFileSync(previewAbsolute, preview)
      previewImage = `/uploads/${previewRelative}`
    } catch {
      previewImage = ''
    }
  }
  const displayName = `${safeFilePart(album.title, '相册')}-${photoNameTime(capturedAt)}-${title}${extension}`
  const result = db.prepare(`
    INSERT INTO album_photos (
      album_id, title, image, description, variant, sort_order, original_name, display_name,
      preview_image, file_hash, file_size, mime_type, width, height, captured_at, camera,
      photo_location, story_text, upload_device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(album.id), title, image, String(body?.description || '').trim().slice(0, 500), cleanVariant(body?.variant),
    cleanSortOrder(body?.sort_order), originalName, displayName, previewImage, hash, file.buffer.length,
    file.mimetype, metadata.width, metadata.height, capturedAt, String(body?.camera || metadata.camera || '').trim().slice(0, 160),
    String(body?.photo_location || '').trim().slice(0, 160), String(body?.story_text || '').trim().slice(0, 2000), deviceId || null,
  )
  updateAlbumTime(Number(album.id))
  return serializePhoto(db.prepare('SELECT * FROM album_photos WHERE id = ?').get(result.lastInsertRowid))
}

export function createDeviceAlbum(req: DeviceRequest, res: Response) {
  const safeTitle = cleanText(req.body?.title, LIMITS.title)
  if (!safeTitle) return error(res, '相册标题不能为空')
  const result = db.prepare(`
    INSERT INTO albums (title, description, cover, event_date, location, icon, story_mode, sort_order, is_active)
    VALUES (?, ?, '', ?, ?, ?, 0, 0, 1)
  `).run(
    safeTitle,
    cleanText(req.body?.description, LIMITS.description),
    cleanText(req.body?.event_date, LIMITS.date),
    cleanText(req.body?.location, LIMITS.location),
    cleanText(req.body?.icon, LIMITS.icon),
  )
  return success(res, albumById(result.lastInsertRowid), '相册已创建')
}

export function updateDeviceAlbum(req: DeviceRequest, res: Response) {
  const id = Number(req.params.id)
  if (!albumById(id)) return error(res, '相册不存在', 'NOT_FOUND', 404)
  const { title, description, event_date, location, icon, story_mode } = req.body || {}
  if (title !== undefined && !cleanText(title, LIMITS.title)) return error(res, '相册标题不能为空')
  db.prepare(`
    UPDATE albums SET title = COALESCE(?, title), description = COALESCE(?, description),
      event_date = COALESCE(?, event_date), location = COALESCE(?, location), icon = COALESCE(?, icon),
      story_mode = COALESCE(?, story_mode), updated_at = datetime('now') WHERE id = ?
  `).run(
    title === undefined ? null : cleanText(title, LIMITS.title),
    description === undefined ? null : cleanText(description, LIMITS.description),
    event_date === undefined ? null : cleanText(event_date, LIMITS.date),
    location === undefined ? null : cleanText(location, LIMITS.location),
    icon === undefined ? null : cleanText(icon, LIMITS.icon),
    story_mode === undefined ? null : (story_mode ? 1 : 0), id,
  )
  return success(res, albumById(id), '相册信息已更新')
}

export async function createDevicePhoto(req: DeviceRequest, res: Response) {
  const album = albumById(req.params.id)
  if (!album || !album.is_active) return error(res, '相册不存在', 'NOT_FOUND', 404)
  if (!req.file) return error(res, '请选择图片')
  try {
    const photo = await storeDevicePhoto(album, req.file, req.body, req.deviceId)
    return success(res, photo, '照片已导入')
  } catch (cause: any) {
    return error(res, cause?.message || '照片导入失败', 'ALBUM_PHOTO_UPLOAD_FAILED', 400)
  }
}

export function updateDevicePhoto(req: DeviceRequest, res: Response) {
  const id = Number(req.params.photoId)
  const photo = db.prepare('SELECT * FROM album_photos WHERE id = ?').get(id) as any
  if (!photo) return error(res, '照片不存在', 'NOT_FOUND', 404)
  const { title, description, variant, sort_order, captured_at, camera, photo_location, story_text } = req.body || {}
  const nextCapturedAt = captured_at === undefined ? null : normalizePhotoTime(captured_at, '')
  const nextTitle = title === undefined ? photo.title : safeFilePart(title, '图片')
  const nextTime = captured_at === undefined ? (photo.captured_at || photo.created_at) : (nextCapturedAt || photo.captured_at || photo.created_at)
  const album = albumById(photo.album_id)
  const nextDisplayName = album
    ? `${safeFilePart(album.title, '相册')}-${photoNameTime(nextTime)}-${nextTitle}${path.extname(photo.original_name || photo.image || '').toLowerCase() || '.jpg'}`
    : photo.display_name
  db.prepare(`
    UPDATE album_photos SET title = COALESCE(?, title), display_name = COALESCE(?, display_name),
      description = COALESCE(?, description), variant = COALESCE(?, variant), sort_order = COALESCE(?, sort_order),
      captured_at = COALESCE(?, captured_at), camera = COALESCE(?, camera), photo_location = COALESCE(?, photo_location),
      story_text = COALESCE(?, story_text), updated_at = datetime('now') WHERE id = ?
  `).run(
    title === undefined ? null : nextTitle,
    nextDisplayName || null,
    description === undefined ? null : cleanText(description, LIMITS.description),
    variant === undefined ? null : cleanVariant(variant),
    sort_order === undefined ? null : cleanSortOrder(sort_order),
    nextCapturedAt, camera === undefined ? null : cleanText(camera, 160),
    photo_location === undefined ? null : cleanText(photo_location, 160),
    story_text === undefined ? null : cleanText(story_text, 2000), id,
  )
  updateAlbumTime(Number(photo.album_id))
  return success(res, serializePhoto(db.prepare('SELECT * FROM album_photos WHERE id = ?').get(id)), '照片信息已更新')
}

export async function createPhoto(req: AuthRequest, res: Response) {
  const { album_id, title, image, description, variant, sort_order, captured_at, camera, photo_location, story_text } = req.body
  const safeImage = cleanText(image, LIMITS.url)
  if (!album_id || !safeImage) return error(res, '请选择相册并填写图片地址')
  const album = db.prepare('SELECT id FROM albums WHERE id = ?').get(Number(album_id))
  if (!album) return error(res, '相册不存在', 'NOT_FOUND', 404)
  const metadata: any = await readPhotoMetadata(safeImage)
  db.prepare(`
    INSERT INTO album_photos (album_id, title, image, description, variant, sort_order, captured_at, camera, photo_location, story_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(album_id),
    cleanText(title, LIMITS.title),
    safeImage,
    cleanText(description, LIMITS.description),
    cleanVariant(variant),
    cleanSortOrder(sort_order),
    cleanText(captured_at || metadata.capturedAt, 40),
    cleanText(camera || metadata.camera, 160),
    cleanText(photo_location || metadata.photoLocation, 160),
    cleanText(story_text, 2000),
  )
  updateAlbumTime(Number(album_id))
  return success(res, null, '照片已添加')
}

export function updatePhoto(req: AuthRequest, res: Response) {
  const { title, image, description, variant, sort_order, captured_at, camera, photo_location, story_text } = req.body
  if (image !== undefined && !cleanText(image, LIMITS.url)) return error(res, '图片地址不能为空')
  const result = db.prepare(`
    UPDATE album_photos
    SET title = COALESCE(?, title),
        image = COALESCE(?, image),
        description = COALESCE(?, description),
        variant = COALESCE(?, variant),
        sort_order = COALESCE(?, sort_order),
        captured_at = COALESCE(?, captured_at),
        camera = COALESCE(?, camera),
        photo_location = COALESCE(?, photo_location),
        story_text = COALESCE(?, story_text),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title === undefined ? null : cleanText(title, LIMITS.title),
    image === undefined ? null : cleanText(image, LIMITS.url),
    description === undefined ? null : cleanText(description, LIMITS.description),
    variant === undefined ? null : cleanVariant(variant),
    sort_order === undefined ? null : cleanSortOrder(sort_order),
    captured_at === undefined ? null : cleanText(captured_at, 40),
    camera === undefined ? null : cleanText(camera, 160),
    photo_location === undefined ? null : cleanText(photo_location, 160),
    story_text === undefined ? null : cleanText(story_text, 2000),
    Number(req.params.photoId),
  )
  if (result.changes === 0) return error(res, '照片不存在', 'NOT_FOUND', 404)
  const photo = db.prepare('SELECT album_id FROM album_photos WHERE id = ?').get(Number(req.params.photoId)) as any
  if (photo) updateAlbumTime(Number(photo.album_id))
  return success(res, null, '照片已更新')
}

export function removePhoto(req: AuthRequest, res: Response) {
  const photo = db.prepare('SELECT album_id FROM album_photos WHERE id = ?').get(Number(req.params.photoId)) as any
  const result = db.prepare('DELETE FROM album_photos WHERE id = ?').run(Number(req.params.photoId))
  if (result.changes === 0) return error(res, '照片不存在', 'NOT_FOUND', 404)
  if (photo) updateAlbumTime(Number(photo.album_id))
  return success(res, null, '照片已删除')
}
