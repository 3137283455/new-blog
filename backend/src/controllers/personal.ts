import { Response } from 'express'
import db from '../config/database'
import { AuthRequest } from '../middleware/auth'
import { renderMarkdown } from '../utils/markdown'
import { error, success } from '../utils/response'

const INBOX_TYPES = new Set(['idea', 'link', 'write', 'watch', 'organize'])

function clean(value: unknown, max = 300) {
  return String(value ?? '').trim().slice(0, max)
}

function slugify(value: unknown, prefix = 'series') {
  const base = clean(value, 120)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w一-鿿-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || prefix
  let slug = base
  let suffix = 1
  while (db.prepare('SELECT 1 FROM article_series WHERE slug = ?').get(slug)) slug = `${base}-${suffix++}`
  return slug
}

function articleSlug(value: unknown) {
  const base = clean(value, 120)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w一-鿿-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `post-${Date.now()}`
  let slug = base
  let suffix = 1
  while (db.prepare('SELECT 1 FROM articles WHERE slug = ?').get(slug)) slug = `${base}-${suffix++}`
  return slug
}

export function submitInbox(req: AuthRequest, res: Response) {
  const type = INBOX_TYPES.has(String(req.body?.type)) ? String(req.body.type) : 'idea'
  const content = clean(req.body?.content || req.body?.text, 500)
  const url = clean(req.body?.url || (type === 'link' ? content : ''), 600)
  if (!content) return error(res, '记录内容不能为空', 'VALIDATION_ERROR')
  const result = db.prepare(`
    INSERT INTO personal_inbox (type, content, url, source)
    VALUES (?, ?, ?, ?)
  `).run(type, content, url, clean(req.body?.source || 'homepage', 30))
  return success(res, db.prepare('SELECT * FROM personal_inbox WHERE id = ?').get(result.lastInsertRowid), '已放入稍后处理')
}

export function inboxList(req: AuthRequest, res: Response) {
  const status = clean(req.query.status, 20)
  const rows = status && status !== 'all'
    ? db.prepare('SELECT * FROM personal_inbox WHERE status = ? ORDER BY created_at DESC, id DESC').all(status)
    : db.prepare('SELECT * FROM personal_inbox ORDER BY CASE status WHEN \'pending\' THEN 0 ELSE 1 END, created_at DESC, id DESC').all()
  return success(res, rows)
}

export function updateInbox(req: AuthRequest, res: Response) {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM personal_inbox WHERE id = ?').get(id) as any
  if (!row) return error(res, '记录不存在', 'NOT_FOUND', 404)
  const type = INBOX_TYPES.has(String(req.body?.type)) ? String(req.body.type) : row.type
  const content = clean(req.body?.content ?? row.content, 500)
  const url = clean(req.body?.url ?? row.url, 600)
  const status = ['pending', 'done', 'archived'].includes(String(req.body?.status)) ? String(req.body.status) : row.status
  db.prepare("UPDATE personal_inbox SET type = ?, content = ?, url = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(type, content, url, status, id)
  return success(res, db.prepare('SELECT * FROM personal_inbox WHERE id = ?').get(id), '记录已更新')
}

export function removeInbox(req: AuthRequest, res: Response) {
  const result = db.prepare('DELETE FROM personal_inbox WHERE id = ?').run(Number(req.params.id))
  if (!result.changes) return error(res, '记录不存在', 'NOT_FOUND', 404)
  return success(res, null, '记录已删除')
}

export function convertInbox(req: AuthRequest, res: Response) {
  const id = Number(req.params.id)
  const item = db.prepare('SELECT * FROM personal_inbox WHERE id = ?').get(id) as any
  if (!item) return error(res, '记录不存在', 'NOT_FOUND', 404)
  if (item.status === 'done' && item.converted_id) return error(res, '这条记录已经转换过了')
  const target = String(req.body?.target || '')
  let convertedId: number

  const convert = db.transaction(() => {
    if (target === 'article') {
      const title = clean(req.body?.title || item.content, 120)
      const content = clean(req.body?.content || `# ${title}\n\n${item.content}`, 20000)
      const result = db.prepare(`
        INSERT INTO articles (title, slug, content, content_html, excerpt, status, visibility, author_id, series_id)
        VALUES (?, ?, ?, ?, ?, 'draft', 'public', ?, ?)
      `).run(title, articleSlug(title), content, renderMarkdown(content), clean(item.content, 180), req.userId || null, Number(req.body?.series_id) || null)
      convertedId = Number(result.lastInsertRowid)
    } else if (target === 'navigation') {
      const url = clean(req.body?.url || item.url || item.content, 600)
      if (!/^(https?:\/\/|\/)/i.test(url)) throw new Error('转换为导航时需要有效网址')
      const title = clean(req.body?.title || (item.type === 'link' ? new URL(url, 'http://local').hostname : item.content), 100)
      const result = db.prepare(`
        INSERT INTO navigation_links (title, url, description, category, workspace, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM navigation_links), 1)
      `).run(title, url, clean(req.body?.description || '', 300), clean(req.body?.category || '临时收藏', 50), clean(req.body?.workspace || 'general', 20))
      convertedId = Number(result.lastInsertRowid)
    } else if (target === 'todo') {
      const result = db.prepare('INSERT INTO personal_todos (title, source_inbox_id) VALUES (?, ?)')
        .run(clean(req.body?.title || item.content, 200), id)
      convertedId = Number(result.lastInsertRowid)
    } else {
      throw new Error('请选择文章、导航或待办')
    }
    db.prepare("UPDATE personal_inbox SET status = 'done', converted_type = ?, converted_id = ?, updated_at = datetime('now') WHERE id = ?")
      .run(target, convertedId, id)
  })

  try {
    convert()
  } catch (cause) {
    return error(res, cause instanceof Error ? cause.message : '转换失败', 'CONVERT_FAILED')
  }
  return success(res, { target, id: convertedId! }, '转换成功')
}

export function todoList(_req: AuthRequest, res: Response) {
  const rows = (db.prepare('SELECT * FROM personal_todos ORDER BY done ASC, created_at DESC, id DESC').all() as any[])
    .map((item) => ({ ...item, done: Boolean(item.done) }))
  return success(res, rows)
}

export function updateTodo(req: AuthRequest, res: Response) {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM personal_todos WHERE id = ?').get(id) as any
  if (!row) return error(res, '待办不存在', 'NOT_FOUND', 404)
  db.prepare("UPDATE personal_todos SET title = ?, done = ?, updated_at = datetime('now') WHERE id = ?")
    .run(clean(req.body?.title ?? row.title, 200), req.body?.done === undefined ? row.done : (req.body.done ? 1 : 0), id)
  return success(res, db.prepare('SELECT * FROM personal_todos WHERE id = ?').get(id), '待办已更新')
}

export function removeTodo(req: AuthRequest, res: Response) {
  const result = db.prepare('DELETE FROM personal_todos WHERE id = ?').run(Number(req.params.id))
  if (!result.changes) return error(res, '待办不存在', 'NOT_FOUND', 404)
  return success(res, null, '待办已删除')
}

export function seriesList(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`
    SELECT s.*, COUNT(a.id) AS article_count,
      COALESCE(SUM(a.view_count), 0) AS total_views,
      MAX(CASE WHEN a.content LIKE '%<!-- boke:epub-novel -->%' THEN 1 ELSE 0 END) AS is_novel
    FROM article_series s
    LEFT JOIN articles a ON a.series_id = s.id AND a.deleted_at IS NULL
      AND a.status = 'published' AND a.visibility = 'public'
    WHERE s.status = 'published'
    GROUP BY s.id
    ORDER BY s.is_featured DESC, s.sort_order ASC, s.created_at DESC
  `).all()
  return success(res, rows)
}

export function seriesDetail(req: AuthRequest, res: Response) {
  const series = db.prepare("SELECT * FROM article_series WHERE slug = ? AND status = 'published'").get(req.params.slug) as any
  if (!series) return error(res, '专题不存在', 'NOT_FOUND', 404)
  const articles = db.prepare(`
    SELECT id, title, slug, excerpt, cover_image, view_count, comment_count, series_order, published_at, created_at
    FROM articles
    WHERE series_id = ? AND status = 'published' AND visibility = 'public' AND deleted_at IS NULL
    ORDER BY series_order ASC, COALESCE(published_at, created_at) ASC
  `).all(series.id)
  const novel = db.prepare(`
    SELECT 1 FROM articles
    WHERE series_id = ? AND deleted_at IS NULL AND content LIKE '%<!-- boke:epub-novel -->%'
    LIMIT 1
  `).get(series.id)
  return success(res, { ...series, articles, article_count: articles.length, is_novel: Boolean(novel) })
}

export function adminSeriesList(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`
    SELECT s.*, COUNT(a.id) AS article_count
    FROM article_series s LEFT JOIN articles a ON a.series_id = s.id AND a.deleted_at IS NULL
    GROUP BY s.id ORDER BY s.sort_order ASC, s.created_at DESC
  `).all()
  return success(res, rows)
}

export function createSeries(req: AuthRequest, res: Response) {
  const title = clean(req.body?.title, 100)
  if (!title) return error(res, '专题标题不能为空', 'VALIDATION_ERROR')
  const result = db.prepare(`
    INSERT INTO article_series (title, slug, description, cover, sort_order, is_featured, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, slugify(req.body?.slug || title), clean(req.body?.description, 1000), clean(req.body?.cover, 600), Number(req.body?.sort_order) || 0, req.body?.is_featured ? 1 : 0, req.body?.status === 'draft' ? 'draft' : 'published')
  return success(res, db.prepare('SELECT * FROM article_series WHERE id = ?').get(result.lastInsertRowid), '专题已创建')
}

export function updateSeries(req: AuthRequest, res: Response) {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM article_series WHERE id = ?').get(id) as any
  if (!row) return error(res, '专题不存在', 'NOT_FOUND', 404)
  const title = clean(req.body?.title ?? row.title, 100)
  let slug = clean(req.body?.slug ?? row.slug, 120) || row.slug
  const duplicate = db.prepare('SELECT id FROM article_series WHERE slug = ? AND id != ?').get(slug, id)
  if (duplicate) slug = slugify(title)
  db.prepare(`
    UPDATE article_series SET title = ?, slug = ?, description = ?, cover = ?, sort_order = ?,
      is_featured = ?, status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(title, slug, clean(req.body?.description ?? row.description, 1000), clean(req.body?.cover ?? row.cover, 600), Number(req.body?.sort_order ?? row.sort_order) || 0, req.body?.is_featured === undefined ? row.is_featured : (req.body.is_featured ? 1 : 0), req.body?.status === 'draft' ? 'draft' : 'published', id)
  return success(res, db.prepare('SELECT * FROM article_series WHERE id = ?').get(id), '专题已更新')
}

export function removeSeries(req: AuthRequest, res: Response) {
  const id = Number(req.params.id)
  const remove = db.transaction(() => {
    db.prepare('UPDATE articles SET series_id = NULL, series_order = 0 WHERE series_id = ?').run(id)
    return db.prepare('DELETE FROM article_series WHERE id = ?').run(id)
  })
  const result = remove()
  if (!result.changes) return error(res, '专题不存在', 'NOT_FOUND', 404)
  return success(res, null, '专题已删除')
}

function streakFromDates(dates: string[]) {
  const unique = [...new Set(dates)].sort().reverse()
  let current = 0
  let longest = 0
  let run = 0
  let previous: Date | null = null
  for (const value of unique) {
    const date = new Date(`${value}T00:00:00Z`)
    if (!previous || Math.round((previous.getTime() - date.getTime()) / 86400000) === 1) run += 1
    else run = 1
    longest = Math.max(longest, run)
    previous = date
  }
  if (unique.length) {
    const latest = new Date(`${unique[0]}T00:00:00Z`)
    const today = new Date(); today.setUTCHours(0, 0, 0, 0)
    const gap = Math.round((today.getTime() - latest.getTime()) / 86400000)
    if (gap <= 1) {
      current = 1
      for (let index = 1; index < unique.length; index += 1) {
        const newer = new Date(`${unique[index - 1]}T00:00:00Z`)
        const older = new Date(`${unique[index]}T00:00:00Z`)
        if (Math.round((newer.getTime() - older.getTime()) / 86400000) !== 1) break
        current += 1
      }
    }
  }
  return { current, longest }
}

export function insights(req: AuthRequest, res: Response) {
  const now = new Date()
  const requestedYear = Number(req.query.year)
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= now.getFullYear() ? requestedYear : now.getFullYear()
  const articleDates = db.prepare(`
    SELECT date(COALESCE(published_at, created_at)) AS day, COUNT(*) AS count, SUM(view_count) AS views
    FROM articles
    WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL
      AND date(COALESCE(published_at, created_at)) >= date('now', '-364 days')
    GROUP BY day ORDER BY day ASC
  `).all() as Array<{ day: string; count: number; views: number }>
  const streak = streakFromDates(articleDates.map((item) => item.day))
  const months = db.prepare(`
    SELECT strftime('%m', COALESCE(published_at, created_at)) AS month,
      COUNT(*) AS articles, SUM(view_count) AS views,
      SUM(LENGTH(COALESCE(content, ''))) AS words
    FROM articles
    WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL
      AND strftime('%Y', COALESCE(published_at, created_at)) = ?
    GROUP BY month ORDER BY month ASC
  `).all(String(year))
  const totals = db.prepare(`
    SELECT COUNT(*) AS articles, COALESCE(SUM(view_count), 0) AS views,
      COALESCE(SUM(comment_count), 0) AS comments,
      COALESCE(SUM(LENGTH(COALESCE(content, ''))), 0) AS words
    FROM articles
    WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL
      AND strftime('%Y', COALESCE(published_at, created_at)) = ?
  `).get(String(year))
  const topArticles = db.prepare(`
    SELECT title, slug, view_count, comment_count, published_at, created_at
    FROM articles
    WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL
      AND strftime('%Y', COALESCE(published_at, created_at)) = ?
    ORDER BY view_count DESC, comment_count DESC LIMIT 5
  `).all(String(year))
  const randomPhoto = db.prepare(`
    SELECT p.*, a.title AS album_title FROM album_photos p
    JOIN albums a ON a.id = p.album_id WHERE a.is_active = 1 ORDER BY RANDOM() LIMIT 1
  `).get()
  const currentMonth = db.prepare(`
    SELECT COUNT(*) AS articles, COALESCE(SUM(view_count), 0) AS views,
      COALESCE(SUM(LENGTH(COALESCE(content, ''))), 0) AS words
    FROM articles WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL
      AND strftime('%Y-%m', COALESCE(published_at, created_at)) = strftime('%Y-%m', 'now')
  `).get()
  return success(res, { year, heatmap: articleDates, streak, months, totals, top_articles: topArticles, current_month: currentMonth, random_photo: randomPhoto })
}
