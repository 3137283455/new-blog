import { Response } from 'express'
import db from '../config/database'
import { success, error } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

const albumSelect = `
  SELECT id, title, description, cover, event_date, location, icon, sort_order,
         is_active, created_at, updated_at
  FROM albums
`

function attachPhotos(albums: any[]) {
  if (!albums.length) return albums
  const ids = albums.map((album) => album.id)
  const placeholders = ids.map(() => '?').join(',')
  const photos = db.prepare(`
    SELECT id, album_id, title, image, description, variant, sort_order, created_at, updated_at
    FROM album_photos
    WHERE album_id IN (${placeholders})
    ORDER BY sort_order ASC, id DESC
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
  const rows = db.prepare(`${albumSelect} WHERE is_active = 1 ORDER BY sort_order ASC, id DESC`).all() as any[]
  return success(res, attachPhotos(rows))
}

export function publicDetail(req: AuthRequest, res: Response) {
  const album = db.prepare(`${albumSelect} WHERE id = ? AND is_active = 1`).get(Number(req.params.id)) as any
  if (!album) return error(res, '相册不存在', 'NOT_FOUND', 404)
  return success(res, attachPhotos([album])[0])
}

export function list(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`${albumSelect} ORDER BY sort_order ASC, id DESC`).all() as any[]
  return success(res, attachPhotos(rows))
}

export function create(req: AuthRequest, res: Response) {
  const { title, description, cover, event_date, location, icon, sort_order, is_active } = req.body
  const safeTitle = cleanText(title, LIMITS.title)
  if (!safeTitle) return error(res, '相册标题不能为空')
  db.prepare(`
    INSERT INTO albums (title, description, cover, event_date, location, icon, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    safeTitle,
    cleanText(description, LIMITS.description),
    cleanText(cover, LIMITS.url),
    cleanText(event_date, LIMITS.date),
    cleanText(location, LIMITS.location),
    cleanText(icon, LIMITS.icon),
    cleanSortOrder(sort_order),
    is_active === false ? 0 : 1,
  )
  return success(res, null, '相册已创建')
}

export function update(req: AuthRequest, res: Response) {
  const { title, description, cover, event_date, location, icon, sort_order, is_active } = req.body
  if (title !== undefined && !cleanText(title, LIMITS.title)) return error(res, '相册标题不能为空')
  const result = db.prepare(`
    UPDATE albums
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        cover = COALESCE(?, cover),
        event_date = COALESCE(?, event_date),
        location = COALESCE(?, location),
        icon = COALESCE(?, icon),
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

export function createPhoto(req: AuthRequest, res: Response) {
  const { album_id, title, image, description, variant, sort_order } = req.body
  const safeImage = cleanText(image, LIMITS.url)
  if (!album_id || !safeImage) return error(res, '请选择相册并填写图片地址')
  const album = db.prepare('SELECT id FROM albums WHERE id = ?').get(Number(album_id))
  if (!album) return error(res, '相册不存在', 'NOT_FOUND', 404)
  db.prepare(`
    INSERT INTO album_photos (album_id, title, image, description, variant, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    Number(album_id),
    cleanText(title, LIMITS.title),
    safeImage,
    cleanText(description, LIMITS.description),
    cleanVariant(variant),
    cleanSortOrder(sort_order),
  )
  return success(res, null, '照片已添加')
}

export function updatePhoto(req: AuthRequest, res: Response) {
  const { title, image, description, variant, sort_order } = req.body
  if (image !== undefined && !cleanText(image, LIMITS.url)) return error(res, '图片地址不能为空')
  const result = db.prepare(`
    UPDATE album_photos
    SET title = COALESCE(?, title),
        image = COALESCE(?, image),
        description = COALESCE(?, description),
        variant = COALESCE(?, variant),
        sort_order = COALESCE(?, sort_order),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title === undefined ? null : cleanText(title, LIMITS.title),
    image === undefined ? null : cleanText(image, LIMITS.url),
    description === undefined ? null : cleanText(description, LIMITS.description),
    variant === undefined ? null : cleanVariant(variant),
    sort_order === undefined ? null : cleanSortOrder(sort_order),
    Number(req.params.photoId),
  )
  if (result.changes === 0) return error(res, '照片不存在', 'NOT_FOUND', 404)
  return success(res, null, '照片已更新')
}

export function removePhoto(req: AuthRequest, res: Response) {
  const result = db.prepare('DELETE FROM album_photos WHERE id = ?').run(Number(req.params.photoId))
  if (result.changes === 0) return error(res, '照片不存在', 'NOT_FOUND', 404)
  return success(res, null, '照片已删除')
}
