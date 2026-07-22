import { Response } from 'express'
import db from '../config/database'
import { success, error } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

function toSlug(text: string): string {
  let slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w一-鿿-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (!slug) slug = 'item-' + Date.now()
  return slug
}

const LIMITS = {
  name: 40,
  description: 300,
  sortOrderMin: 0,
  sortOrderMax: 9999,
}

function cleanName(value: unknown) {
  return String(value || '').trim().slice(0, LIMITS.name)
}

function cleanDescription(value: unknown) {
  return String(value || '').trim().slice(0, LIMITS.description)
}

function cleanSortOrder(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(LIMITS.sortOrderMin, Math.min(LIMITS.sortOrderMax, Math.trunc(parsed)))
}

// ===== 公开 =====
export function list(_req: AuthRequest, res: Response) {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all()
  return success(res, categories)
}

export function tagList(_req: AuthRequest, res: Response) {
  const tags = db.prepare('SELECT * FROM tags ORDER BY name ASC').all()
  return success(res, tags)
}

// ===== 管理 =====
export function create(req: AuthRequest, res: Response) {
  const { name, description } = req.body
  const safeName = cleanName(name)
  if (!safeName) return error(res, '分类名称不能为空')
  if (String(name || '').trim().length > LIMITS.name) return error(res, `分类名称不能超过 ${LIMITS.name} 个字符`, 'NAME_TOO_LONG', 400)
  let slug = toSlug(safeName)
  const existing = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)
  if (existing) slug = slug + '-' + Date.now()
  try {
    db.prepare('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)').run(safeName, slug, cleanDescription(description))
    return success(res, null, '分类创建成功')
  } catch (err: any) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return error(res, '分类已存在，请换一个名称', 'CATEGORY_EXISTS', 409)
    }
    return error(res, '分类创建失败', 'CATEGORY_CREATE_FAILED', 500)
  }
}

export function update(req: AuthRequest, res: Response) {
  const { name, description, sort_order } = req.body
  const { id } = req.params
  const safeName = name === undefined ? undefined : cleanName(name)
  if (name !== undefined && !safeName) return error(res, '分类名称不能为空')
  if (name !== undefined && String(name || '').trim().length > LIMITS.name) return error(res, `分类名称不能超过 ${LIMITS.name} 个字符`, 'NAME_TOO_LONG', 400)
  let slug = safeName ? toSlug(safeName) : undefined
  if (slug) {
    const existing = db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(slug, Number(id))
    if (existing) return error(res, '分类 slug 已存在，请换一个名称', 'SLUG_EXISTS', 409)
  }
  const result = db.prepare('UPDATE categories SET name=COALESCE(?,name), slug=COALESCE(?,slug), description=COALESCE(?,description), sort_order=COALESCE(?,sort_order) WHERE id=?')
    .run(safeName, slug, description === undefined ? undefined : cleanDescription(description), cleanSortOrder(sort_order), Number(id))
  if (result.changes === 0) return error(res, '分类不存在', 'NOT_FOUND', 404)
  return success(res, null, '分类更新成功')
}

export function remove(req: AuthRequest, res: Response) {
  const { id } = req.params
  db.prepare('UPDATE articles SET category_id = NULL WHERE category_id = ?').run(Number(id))
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(Number(id))
  if (result.changes === 0) return error(res, '分类不存在', 'NOT_FOUND', 404)
  return success(res, null, '分类已删除')
}

// 标签管理
export function createTag(req: AuthRequest, res: Response) {
  const { name } = req.body
  const safeName = cleanName(name)
  if (!safeName) return error(res, '标签名称不能为空')
  if (String(name || '').trim().length > LIMITS.name) return error(res, `标签名称不能超过 ${LIMITS.name} 个字符`, 'NAME_TOO_LONG', 400)
  let slug = toSlug(safeName)
  const existing = db.prepare('SELECT id FROM tags WHERE slug = ?').get(slug)
  if (existing) slug = slug + '-' + Date.now()
  try {
    db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)').run(safeName, slug)
    return success(res, null, '标签创建成功')
  } catch (err: any) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return error(res, '标签已存在，请换一个名称', 'TAG_EXISTS', 409)
    }
    return error(res, '标签创建失败', 'TAG_CREATE_FAILED', 500)
  }
}

export function updateTag(req: AuthRequest, res: Response) {
  const { name } = req.body
  const { id } = req.params
  const safeName = name === undefined ? undefined : cleanName(name)
  if (name !== undefined && !safeName) return error(res, '标签名称不能为空')
  if (name !== undefined && String(name || '').trim().length > LIMITS.name) return error(res, `标签名称不能超过 ${LIMITS.name} 个字符`, 'NAME_TOO_LONG', 400)
  let slug = safeName ? toSlug(safeName) : undefined
  if (slug) {
    const existing = db.prepare('SELECT id FROM tags WHERE slug = ? AND id != ?').get(slug, Number(id))
    if (existing) return error(res, '标签 slug 已存在，请换一个名称', 'SLUG_EXISTS', 409)
  }
  const result = db.prepare('UPDATE tags SET name=COALESCE(?,name), slug=COALESCE(?,slug) WHERE id=?').run(safeName, slug, Number(id))
  if (result.changes === 0) return error(res, '标签不存在', 'NOT_FOUND', 404)
  return success(res, null, '标签更新成功')
}

export function removeTag(req: AuthRequest, res: Response) {
  const { id } = req.params
  db.prepare('DELETE FROM article_tags WHERE tag_id = ?').run(Number(id))
  const result = db.prepare('DELETE FROM tags WHERE id = ?').run(Number(id))
  if (result.changes === 0) return error(res, '标签不存在', 'NOT_FOUND', 404)
  return success(res, null, '标签已删除')
}
