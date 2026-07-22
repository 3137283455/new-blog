import { Response } from 'express'
import db from '../config/database'
import { success, error } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

const selectSql = `
  SELECT id, title, url, description, category, icon, avatar, sort_order, is_active, created_at, updated_at
  FROM navigation_links
`

const LIMITS = {
  title: 80,
  url: 500,
  description: 300,
  category: 40,
  icon: 40,
  sortOrderMin: -9999,
  sortOrderMax: 9999,
}

function cleanText(value: unknown, max = 300) {
  return String(value ?? '').trim().slice(0, max)
}

function cleanSortOrder(value: unknown) {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(LIMITS.sortOrderMin, Math.min(LIMITS.sortOrderMax, Math.trunc(parsed)))
}

function isSafeLink(value: string) {
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(value)
}

export function publicList(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`${selectSql} WHERE COALESCE(is_active, 1) != 0 ORDER BY category ASC, sort_order ASC, id DESC`).all()
  return success(res, rows)
}

export function list(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`${selectSql} ORDER BY category ASC, sort_order ASC, id DESC`).all()
  return success(res, rows)
}

export function create(req: AuthRequest, res: Response) {
  const { title, url, description, category, icon, avatar, sort_order, is_active } = req.body
  const safeTitle = cleanText(title, LIMITS.title)
  const safeUrl = cleanText(url, LIMITS.url)
  if (!safeTitle || !safeUrl) return error(res, '标题和链接不能为空')
  if (!isSafeLink(safeUrl)) return error(res, '链接需以 http(s)、/、#、mailto: 或 tel: 开头', 'INVALID_URL', 400)
  db.prepare(`
    INSERT INTO navigation_links (title, url, description, category, icon, avatar, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    safeTitle,
    safeUrl,
    cleanText(description, LIMITS.description),
    cleanText(category, LIMITS.category) || '默认',
    cleanText(icon, LIMITS.icon),
    cleanText(avatar, LIMITS.url),
    cleanSortOrder(sort_order),
    is_active === false ? 0 : 1,
  )
  return success(res, null, '导航已创建')
}

export function update(req: AuthRequest, res: Response) {
  const { title, url, description, category, icon, avatar, sort_order, is_active } = req.body
  if (title !== undefined && !cleanText(title, LIMITS.title)) return error(res, '标题不能为空')
  if (url !== undefined && !cleanText(url, LIMITS.url)) return error(res, '链接不能为空')
  if (url !== undefined && !isSafeLink(cleanText(url, LIMITS.url))) return error(res, '链接需以 http(s)、/、#、mailto: 或 tel: 开头', 'INVALID_URL', 400)
  const result = db.prepare(`
    UPDATE navigation_links
    SET title = COALESCE(?, title),
        url = COALESCE(?, url),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        icon = COALESCE(?, icon),
        avatar = COALESCE(?, avatar),
        sort_order = COALESCE(?, sort_order),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title === undefined ? null : cleanText(title, LIMITS.title),
    url === undefined ? null : cleanText(url, LIMITS.url),
    description === undefined ? null : cleanText(description, LIMITS.description),
    category === undefined ? null : cleanText(category, LIMITS.category),
    icon === undefined ? null : cleanText(icon, LIMITS.icon),
    avatar === undefined ? null : cleanText(avatar, LIMITS.url),
    sort_order === undefined ? null : cleanSortOrder(sort_order),
    is_active === undefined ? null : (is_active ? 1 : 0),
    Number(req.params.id),
  )
  if (result.changes === 0) return error(res, '导航不存在', 'NOT_FOUND', 404)
  return success(res, null, '导航已更新')
}

export function remove(req: AuthRequest, res: Response) {
  const result = db.prepare('DELETE FROM navigation_links WHERE id = ?').run(Number(req.params.id))
  if (result.changes === 0) return error(res, '导航不存在', 'NOT_FOUND', 404)
  return success(res, null, '导航已删除')
}
