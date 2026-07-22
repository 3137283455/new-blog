import { Response } from 'express'
import db from '../config/database'
import { success, error } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

const selectSql = `
  SELECT id, title, original_title, cover, url, status, progress, rating, season, summary,
         sort_order, is_active, created_at, updated_at
  FROM bangumi_items
`

const LIMITS = {
  title: 100,
  url: 500,
  status: 30,
  progress: 60,
  season: 60,
  summary: 500,
  sortOrderMin: -9999,
  sortOrderMax: 9999,
}

const allowedStatus = new Set(['watching', 'done', 'plan', 'planned', 'paused', 'dropped'])

function cleanText(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function cleanSortOrder(value: unknown) {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(LIMITS.sortOrderMin, Math.min(LIMITS.sortOrderMax, Math.trunc(parsed)))
}

function cleanRating(value: unknown) {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(10, parsed))
}

function cleanStatus(value: unknown) {
  const status = cleanText(value, LIMITS.status) || 'watching'
  return allowedStatus.has(status) ? status : 'watching'
}

export function publicList(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`${selectSql} WHERE is_active = 1 ORDER BY sort_order ASC, id DESC`).all()
  return success(res, rows)
}

export function list(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`${selectSql} ORDER BY sort_order ASC, id DESC`).all()
  return success(res, rows)
}

export function create(req: AuthRequest, res: Response) {
  const { title, original_title, cover, url, status, progress, rating, season, summary, sort_order, is_active } = req.body
  const safeTitle = cleanText(title, LIMITS.title)
  if (!safeTitle) return error(res, '番剧标题不能为空')
  db.prepare(`
    INSERT INTO bangumi_items
      (title, original_title, cover, url, status, progress, rating, season, summary, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    safeTitle,
    cleanText(original_title, LIMITS.title),
    cleanText(cover, LIMITS.url),
    cleanText(url, LIMITS.url),
    cleanStatus(status),
    cleanText(progress, LIMITS.progress),
    cleanRating(rating),
    cleanText(season, LIMITS.season),
    cleanText(summary, LIMITS.summary),
    cleanSortOrder(sort_order),
    is_active === false ? 0 : 1,
  )
  return success(res, null, '追番已创建')
}

export function update(req: AuthRequest, res: Response) {
  const { title, original_title, cover, url, status, progress, rating, season, summary, sort_order, is_active } = req.body
  if (title !== undefined && !cleanText(title, LIMITS.title)) return error(res, '番剧标题不能为空')
  const result = db.prepare(`
    UPDATE bangumi_items
    SET title = COALESCE(?, title),
        original_title = COALESCE(?, original_title),
        cover = COALESCE(?, cover),
        url = COALESCE(?, url),
        status = COALESCE(?, status),
        progress = COALESCE(?, progress),
        rating = COALESCE(?, rating),
        season = COALESCE(?, season),
        summary = COALESCE(?, summary),
        sort_order = COALESCE(?, sort_order),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title === undefined ? null : cleanText(title, LIMITS.title),
    original_title === undefined ? null : cleanText(original_title, LIMITS.title),
    cover === undefined ? null : cleanText(cover, LIMITS.url),
    url === undefined ? null : cleanText(url, LIMITS.url),
    status === undefined ? null : cleanStatus(status),
    progress === undefined ? null : cleanText(progress, LIMITS.progress),
    rating === undefined ? null : cleanRating(rating),
    season === undefined ? null : cleanText(season, LIMITS.season),
    summary === undefined ? null : cleanText(summary, LIMITS.summary),
    sort_order === undefined ? null : cleanSortOrder(sort_order),
    is_active === undefined ? null : (is_active ? 1 : 0),
    Number(req.params.id),
  )
  if (result.changes === 0) return error(res, '追番不存在', 'NOT_FOUND', 404)
  return success(res, null, '追番已更新')
}

export function remove(req: AuthRequest, res: Response) {
  const result = db.prepare('DELETE FROM bangumi_items WHERE id = ?').run(Number(req.params.id))
  if (result.changes === 0) return error(res, '追番不存在', 'NOT_FOUND', 404)
  return success(res, null, '追番已删除')
}
