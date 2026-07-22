import { Response } from 'express'
import db from '../config/database'
import { success, error, paginationResult } from '../utils/response'
import { AuthRequest } from '../middleware/auth'
import { renderMarkdown } from '../utils/markdown'

function toSlug(text: string): string {
  let slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w一-鿿-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (!slug) slug = 'page-' + Date.now()
  return slug
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeStatus(value: unknown) {
  return cleanText(value) === 'draft' ? 'draft' : 'published'
}

// ===== 公开 =====
export function publicList(_req: AuthRequest, res: Response) {
  const pages = db.prepare(`
    SELECT id, title, slug, template, status, created_at, updated_at
    FROM pages
    WHERE status = 'published' AND deleted_at IS NULL
    ORDER BY created_at ASC
  `).all()
  return success(res, pages)
}

export function getBySlug(req: AuthRequest, res: Response) {
  const page = db.prepare("SELECT * FROM pages WHERE slug = ? AND status = 'published' AND deleted_at IS NULL").get(req.params.slug) as any
  if (!page) return error(res, '页面不存在', 'NOT_FOUND', 404)
  return success(res, page)
}

// ===== 管理 =====
export function list(req: AuthRequest, res: Response) {
  const trashed = String(req.query.trashed || '') === 'true'
  const pages = db.prepare(`SELECT * FROM pages WHERE deleted_at IS ${trashed ? 'NOT NULL' : 'NULL'} ORDER BY created_at DESC`).all()
  return success(res, pages)
}

export function create(req: AuthRequest, res: Response) {
  const { title, content, template, status } = req.body
  const safeTitle = cleanText(title)
  if (!safeTitle) return error(res, '页面标题不能为空')
  let slug = toSlug(safeTitle)
  const existing = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug)
  if (existing) slug = slug + '-' + Date.now()
  const html = content ? renderMarkdown(content) : ''
  db.prepare('INSERT INTO pages (title, slug, content, content_html, template, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(safeTitle, slug, String(content || ''), html, cleanText(template) || 'default', normalizeStatus(status))
  return success(res, null, '页面创建成功')
}

export function update(req: AuthRequest, res: Response) {
  const { title, content, template, status } = req.body
  const { id } = req.params
  const safeTitle = title === undefined ? undefined : cleanText(title)
  if (title !== undefined && !safeTitle) return error(res, '页面标题不能为空')
  let slug = safeTitle ? toSlug(safeTitle) : undefined
  if (slug) {
    const existing = db.prepare('SELECT id FROM pages WHERE slug = ? AND id != ?').get(slug, Number(id))
    if (existing) return error(res, '页面 slug 已存在，请换一个标题', 'SLUG_EXISTS', 409)
  }
  const html = content ? renderMarkdown(content) : undefined
  const result = db.prepare(`UPDATE pages SET title=COALESCE(?,title), slug=COALESCE(?,slug), content=COALESCE(?,content), content_html=COALESCE(?,content_html), template=COALESCE(?,template), status=COALESCE(?,status), updated_at=datetime('now') WHERE id=?`)
    .run(
      safeTitle,
      slug,
      content === undefined ? null : String(content),
      html,
      template === undefined ? null : cleanText(template) || 'default',
      status === undefined ? null : normalizeStatus(status),
      Number(id),
    )
  if (result.changes === 0) return error(res, '页面不存在', 'NOT_FOUND', 404)
  return success(res, null, '页面更新成功')
}

export function remove(req: AuthRequest, res: Response) {
  const result = db.prepare("UPDATE pages SET deleted_at = datetime('now'), status = 'draft', updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL").run(Number(req.params.id))
  if (result.changes === 0) return error(res, '页面不存在', 'NOT_FOUND', 404)
  return success(res, null, '页面已移入回收站')
}

export function restore(req: AuthRequest, res: Response) {
  const result = db.prepare("UPDATE pages SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?").run(Number(req.params.id))
  if (result.changes === 0) return error(res, '页面不存在', 'NOT_FOUND', 404)
  return success(res, null, '页面已恢复')
}

export function forceDelete(req: AuthRequest, res: Response) {
  const result = db.prepare('DELETE FROM pages WHERE id = ?').run(Number(req.params.id))
  if (result.changes === 0) return error(res, '页面不存在', 'NOT_FOUND', 404)
  return success(res, null, '页面已永久删除')
}
