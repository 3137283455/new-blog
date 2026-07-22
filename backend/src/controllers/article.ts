import { Response } from 'express'
import db from '../config/database'
import { config } from '../config'
import { success, error, paginationResult } from '../utils/response'
import { AuthRequest } from '../middleware/auth'
import { renderMarkdown } from '../utils/markdown'

/*
  // 为图片和 iframe 添加懒加载
  html = html.replace(/<img /g, '<img loading="lazy" ')
*/
function escapeHtml(value: string): string {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char))
}

function generateSlug(title: string): string {
  let slug = title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w一-鿿-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (!slug) slug = 'post-' + Date.now()
  return slug
}

function normalizePage(value: unknown) {
  const page = Number(value)
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function normalizePageSize(value: unknown) {
  const pageSize = Number(value)
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 10
  return Math.min(Math.floor(pageSize), 50)
}

// ===== 公开接口 =====

export function list(req: AuthRequest, res: Response) {
  const page = normalizePage(req.query.page)
  const pageSize = normalizePageSize(req.query.pageSize)
  const category = req.query.category as string
  const tag = req.query.tag as string
  const sort = (req.query.sort as string) || 'latest'
  const pinned = req.query.pinned as string

  let where: string
  const params: any[] = []

  where = "WHERE a.deleted_at IS NULL AND a.status = 'published' AND a.visibility = 'public'"
  if (category) {
    where += ' AND c.slug = ?'
    params.push(category)
  }
  if (tag) {
    where += ' AND t.slug = ?'
    params.push(tag)
  }
  if (pinned === 'true') {
    where += ' AND a.is_pinned = 1'
  }

  let orderBy = 'ORDER BY a.created_at DESC'
  if (sort === 'popular') orderBy = 'ORDER BY a.view_count DESC'
  if (sort === 'oldest') orderBy = 'ORDER BY a.created_at ASC'

  // 置顶文章优先
  orderBy = 'ORDER BY a.is_pinned DESC, ' + orderBy.replace('ORDER BY ', '')

  const offset = (page - 1) * pageSize

  let query = `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
  `
  if (tag) {
    query += `
      LEFT JOIN article_tags at2 ON a.id = at2.article_id
      LEFT JOIN tags t ON at2.tag_id = t.id
    `
  }
  query += ` ${where} ${orderBy} LIMIT ? OFFSET ?`
  params.push(pageSize, offset)

  const articles = db.prepare(query).all(...params) as any[]

  // 获取每个文章的标签
  const tagStmt = db.prepare(`
    SELECT t.* FROM tags t
    JOIN article_tags at2 ON t.id = at2.tag_id
    WHERE at2.article_id = ?
  `)

  const articlesWithTags = articles.map((a: any) => ({
    ...a,
    is_pinned: !!a.is_pinned,
    is_recommended: !!a.is_recommended,
    tags: tagStmt.all(a.id),
  }))

  // 总数
  let countQuery = `SELECT COUNT(*) as total FROM articles a LEFT JOIN categories c ON a.category_id = c.id`
  if (tag) {
    countQuery += ` LEFT JOIN article_tags at2 ON a.id = at2.article_id LEFT JOIN tags t ON at2.tag_id = t.id`
  }
  countQuery += ` ${where}`
  const { total } = db.prepare(countQuery).get(...params.slice(0, -2)) as any

  return success(res, articlesWithTags, '获取成功', paginationResult(page, pageSize, total))
}

export function adminList(req: AuthRequest, res: Response) {
  const page = normalizePage(req.query.page)
  const pageSize = normalizePageSize(req.query.pageSize)
  const category = req.query.category as string
  const tag = req.query.tag as string
  const sort = (req.query.sort as string) || 'latest'
  const pinned = req.query.pinned as string
  const trashed = req.query.trashed as string
  const status = req.query.status as string

  let where = trashed === 'true' ? 'WHERE a.deleted_at IS NOT NULL' : 'WHERE a.deleted_at IS NULL'
  const params: any[] = []

  if (trashed !== 'true') {
    if (status === 'draft' || status === 'published') {
      where += ' AND a.status = ?'
      params.push(status)
    }
  }
  if (category) {
    where += ' AND c.slug = ?'
    params.push(category)
  }
  if (tag) {
    where += ' AND t.slug = ?'
    params.push(tag)
  }
  if (pinned === 'true') {
    where += ' AND a.is_pinned = 1'
  }

  let orderBy = 'ORDER BY a.created_at DESC'
  if (sort === 'popular') orderBy = 'ORDER BY a.view_count DESC'
  if (sort === 'oldest') orderBy = 'ORDER BY a.created_at ASC'
  orderBy = 'ORDER BY a.is_pinned DESC, ' + orderBy.replace('ORDER BY ', '')

  const offset = (page - 1) * pageSize
  let query = `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
  `
  if (tag) {
    query += `
      LEFT JOIN article_tags at2 ON a.id = at2.article_id
      LEFT JOIN tags t ON at2.tag_id = t.id
    `
  }
  query += ` ${where} ${orderBy} LIMIT ? OFFSET ?`
  params.push(pageSize, offset)

  const articles = db.prepare(query).all(...params) as any[]
  const tagStmt = db.prepare(`
    SELECT t.* FROM tags t
    JOIN article_tags at2 ON t.id = at2.tag_id
    WHERE at2.article_id = ?
  `)

  const articlesWithTags = articles.map((a: any) => ({
    ...a,
    is_pinned: !!a.is_pinned,
    is_recommended: !!a.is_recommended,
    tags: tagStmt.all(a.id),
  }))

  let countQuery = `SELECT COUNT(DISTINCT a.id) as total FROM articles a LEFT JOIN categories c ON a.category_id = c.id`
  if (tag) {
    countQuery += ` LEFT JOIN article_tags at2 ON a.id = at2.article_id LEFT JOIN tags t ON at2.tag_id = t.id`
  }
  countQuery += ` ${where}`
  const { total } = db.prepare(countQuery).get(...params.slice(0, -2)) as any

  return success(res, articlesWithTags, '获取成功', paginationResult(page, pageSize, total))
}

export function detail(req: AuthRequest, res: Response) {
  const { slug } = req.params

  const article = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.slug = ? AND a.status = 'published' AND a.visibility = 'public' AND a.deleted_at IS NULL
  `).get(slug) as any

  if (!article) {
    return error(res, '文章不存在', 'NOT_FOUND', 404)
  }

  // 增加阅读量
  db.prepare('UPDATE articles SET view_count = view_count + 1 WHERE id = ?').run(article.id)

  // 获取标签
  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN article_tags at2 ON t.id = at2.tag_id
    WHERE at2.article_id = ?
  `).all(article.id)

  return success(res, {
    ...article,
    is_pinned: !!article.is_pinned,
    is_recommended: !!article.is_recommended,
    tags,
  })
}

export function search(req: AuthRequest, res: Response) {
  const q = String(req.query.q || '').trim().slice(0, 80)
  const page = normalizePage(req.query.page)
  const pageSize = normalizePageSize(req.query.pageSize)

  if (!q) {
    return success(res, [], '请输入搜索关键词')
  }

  const offset = (page - 1) * pageSize
  const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`)
  const likeQ = `%${escapeLike(q)}%`

  // LIKE 模糊搜索（对中文友好，覆盖标题+正文+摘要+标签）
  const results = db.prepare(`
    SELECT
      a.*,
      c.name as category_name,
      c.slug as category_slug,
      GROUP_CONCAT(DISTINCT t.name) as tag_names
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN article_tags at2 ON a.id = at2.article_id
    LEFT JOIN tags t ON at2.tag_id = t.id
    WHERE (a.title LIKE ? ESCAPE '\\' OR a.content LIKE ? ESCAPE '\\' OR a.excerpt LIKE ? ESCAPE '\\' OR t.name LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')
      AND a.status = 'published' AND a.visibility = 'public' AND a.deleted_at IS NULL
    GROUP BY a.id
    ORDER BY a.is_pinned DESC, a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(likeQ, likeQ, likeQ, likeQ, likeQ, pageSize, offset) as any[]

  const { total } = db.prepare(`
    SELECT COUNT(DISTINCT a.id) as total
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN article_tags at2 ON a.id = at2.article_id
    LEFT JOIN tags t ON at2.tag_id = t.id
    WHERE (a.title LIKE ? ESCAPE '\\' OR a.content LIKE ? ESCAPE '\\' OR a.excerpt LIKE ? ESCAPE '\\' OR t.name LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')
      AND a.status = 'published' AND a.visibility = 'public' AND a.deleted_at IS NULL
  `).get(likeQ, likeQ, likeQ, likeQ, likeQ) as any

  // 手动生成关键词高亮摘要
  const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const highlightRe = new RegExp(`(${escapedQ})`, 'gi')
  const stripMd = (s: string) => s.replace(/[#*`>\-_\[\]()!]/g, '').replace(/\n+/g, ' ')

  const withHighlight = results.map((a: any) => {
    const plain = stripMd(a.content || '')
    let snippet = plain
    const idx = plain.toLowerCase().indexOf(q.toLowerCase())
    if (idx >= 0) {
      const start = Math.max(0, idx - 40)
      snippet = (start > 0 ? '...' : '') + plain.slice(start, start + 120) + '...'
    } else {
      snippet = plain.slice(0, 120) + (plain.length > 120 ? '...' : '')
    }
    const safeTitle = escapeHtml(a.title || '')
    const safeSnippet = escapeHtml(snippet)
    const safeCategory = escapeHtml(a.category_name || '')
    const tags = String(a.tag_names || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    return {
      ...a,
      tags,
      title_highlight: safeTitle.replace(highlightRe, '<mark>$1</mark>'),
      content_snippet: safeSnippet.replace(highlightRe, '<mark>$1</mark>'),
      category_highlight: safeCategory.replace(highlightRe, '<mark>$1</mark>'),
      tags_highlight: tags.map((tag) => escapeHtml(tag).replace(highlightRe, '<mark>$1</mark>')),
    }
  })

  return success(res, withHighlight, '搜索完成', paginationResult(page, pageSize, total))
}

export function like(req: AuthRequest, res: Response) {
  const { id } = req.params
  const ip = req.ip || req.socket.remoteAddress || ''
  const article = db.prepare(`
    SELECT id FROM articles
    WHERE id = ? AND status = 'published' AND visibility = 'public' AND deleted_at IS NULL
  `).get(Number(id))
  if (!article) {
    return error(res, '文章不存在', 'NOT_FOUND', 404)
  }

  // 检查是否已点赞
  const existing = db.prepare('SELECT id FROM likes WHERE article_id = ? AND ip = ?').get(Number(id), ip)
  if (existing) {
    return error(res, '您已经点赞过了', 'ALREADY_LIKED')
  }

  db.prepare('INSERT INTO likes (article_id, ip) VALUES (?, ?)').run(Number(id), ip)
  db.prepare('UPDATE articles SET like_count = like_count + 1 WHERE id = ?').run(Number(id))

  return success(res, null, '点赞成功')
}

// ===== 管理接口 =====

export function getById(req: AuthRequest, res: Response) {
  const article = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE a.id = ?
  `).get(Number(req.params.id)) as any
  if (!article) return error(res, '文章不存在', 'NOT_FOUND', 404)
  const tags = db.prepare('SELECT t.* FROM tags t JOIN article_tags at2 ON t.id = at2.tag_id WHERE at2.article_id = ?').all(article.id)
  return success(res, { ...article, is_pinned: !!article.is_pinned, is_recommended: !!article.is_recommended, tags })
}

export function create(req: AuthRequest, res: Response) {
  const {
    title, content, excerpt, cover_image, status, visibility, category_id, tag_ids, is_pinned, is_recommended,
    title_font_family, title_font_url, body_font_family, body_font_url,
  } = req.body
  if (!title || !content) {
    return error(res, '标题和内容不能为空', 'VALIDATION_ERROR')
  }

  let slug = generateSlug(title)
  // 确保 slug 唯一
  const existing = db.prepare('SELECT id FROM articles WHERE slug = ?').get(slug)
  if (existing) {
    slug = slug + '-' + Date.now()
  }

  const contentHtml = renderMarkdown(content)
  const publishedAt = status === 'published' ? new Date().toISOString() : null

  const result = db.prepare(`
    INSERT INTO articles
      (title, slug, content, content_html, excerpt, cover_image, status, visibility, is_pinned, is_recommended,
       title_font_family, title_font_url, body_font_family, body_font_url, author_id, category_id, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, slug, content, contentHtml, excerpt || '', cover_image || '',
    status || 'draft', visibility || 'public', is_pinned ? 1 : 0, is_recommended ? 1 : 0,
    title_font_family || '', title_font_url || '', body_font_family || '', body_font_url || '',
    req.userId!, category_id || null, publishedAt
  )

  // 关联标签
  if (tag_ids && tag_ids.length > 0) {
    const insertTag = db.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)')
    for (const tagId of tag_ids) {
      insertTag.run(result.lastInsertRowid, tagId)
    }
  }

  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid)
  return success(res, article, '文章创建成功')
}

export function update(req: AuthRequest, res: Response) {
  const { id } = req.params
  const {
    title, content, excerpt, cover_image, status, visibility, category_id, tag_ids, is_pinned, is_recommended,
    title_font_family, title_font_url, body_font_family, body_font_url,
  } = req.body

  const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(Number(id)) as any
  if (!existing) {
    return error(res, '文章不存在', 'NOT_FOUND', 404)
  }

  let slug = existing.slug
  if (title && title !== existing.title) {
    slug = generateSlug(title)
    const dup = db.prepare('SELECT id FROM articles WHERE slug = ? AND id != ?').get(slug, Number(id))
    if (dup) slug = slug + '-' + Date.now()
  }

  const contentHtml = content ? renderMarkdown(content) : existing.content_html
  const publishedAt = status === 'published' && !existing.published_at ? new Date().toISOString() : existing.published_at

  db.prepare(`
    UPDATE articles SET title=?, slug=?, content=?, content_html=?, excerpt=?, cover_image=?,
      status=?, visibility=?, is_pinned=?, is_recommended=?,
      title_font_family=?, title_font_url=?, body_font_family=?, body_font_url=?,
      category_id=?, published_at=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    title || existing.title, slug, content || existing.content, contentHtml,
    excerpt !== undefined ? excerpt : existing.excerpt,
    cover_image !== undefined ? cover_image : existing.cover_image,
    status || existing.status, visibility || existing.visibility,
    is_pinned !== undefined ? (is_pinned ? 1 : 0) : existing.is_pinned,
    is_recommended !== undefined ? (is_recommended ? 1 : 0) : existing.is_recommended,
    title_font_family !== undefined ? title_font_family : existing.title_font_family,
    title_font_url !== undefined ? title_font_url : existing.title_font_url,
    body_font_family !== undefined ? body_font_family : existing.body_font_family,
    body_font_url !== undefined ? body_font_url : existing.body_font_url,
    category_id !== undefined ? category_id : existing.category_id,
    publishedAt, Number(id)
  )

  // 更新标签关联
  if (tag_ids) {
    db.prepare('DELETE FROM article_tags WHERE article_id = ?').run(Number(id))
    const insertTag = db.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)')
    for (const tagId of tag_ids) {
      insertTag.run(Number(id), tagId)
    }
  }

  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(Number(id))
  return success(res, article, '文章更新成功')
}

export function softDelete(req: AuthRequest, res: Response) {
  const { id } = req.params
  const result = db.prepare("UPDATE articles SET deleted_at = datetime('now'), status = 'draft' WHERE id = ?").run(Number(id))
  if (result.changes === 0) return error(res, '文章不存在', 'NOT_FOUND', 404)
  return success(res, null, '文章已移入回收站')
}

export function batchDelete(req: AuthRequest, res: Response) {
  const { ids } = req.body
  if (!ids || !ids.length) return error(res, '请选择要删除的文章')
  const stmt = db.prepare("UPDATE articles SET deleted_at = datetime('now'), status = 'draft' WHERE id = ?")
  let movedCount = 0
  for (const id of ids) {
    movedCount += stmt.run(id).changes
  }
  if (movedCount === 0) return error(res, '没有可删除的文章', 'NOT_FOUND', 404)
  return success(res, { moved: movedCount }, `已删除 ${movedCount} 篇文章`)
}

export function restore(req: AuthRequest, res: Response) {
  const { id } = req.params
  const result = db.prepare('UPDATE articles SET deleted_at = NULL WHERE id = ?').run(Number(id))
  if (result.changes === 0) return error(res, '文章不存在', 'NOT_FOUND', 404)
  return success(res, null, '文章已恢复')
}

export function forceDelete(req: AuthRequest, res: Response) {
  const { id } = req.params
  const article = db.prepare('SELECT id FROM articles WHERE id = ?').get(Number(id))
  if (!article) return error(res, '文章不存在', 'NOT_FOUND', 404)
  db.prepare('DELETE FROM article_tags WHERE article_id = ?').run(Number(id))
  db.prepare('DELETE FROM comments WHERE article_id = ?').run(Number(id))
  db.prepare('DELETE FROM likes WHERE article_id = ?').run(Number(id))
  const result = db.prepare('DELETE FROM articles WHERE id = ?').run(Number(id))
  if (result.changes === 0) return error(res, '文章不存在', 'NOT_FOUND', 404)
  return success(res, null, '文章已永久删除')
}

// ===== RSS Feed =====
export function rss(_req: AuthRequest, res: Response) {
  const siteTitle = (db.prepare("SELECT value FROM settings WHERE key = 'site_title'").get() as any)?.value || 'My Blog'
  const siteDesc = (db.prepare("SELECT value FROM settings WHERE key = 'site_description'").get() as any)?.value || ''
  const baseUrl = process.env.SITE_URL || `http://localhost:${config.port}`

  const posts = db.prepare(`
    SELECT title, slug, excerpt, content_html, published_at, created_at
    FROM articles WHERE status = 'published' AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 20
  `).all() as any[]

  const items = posts.map((p: any) => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${baseUrl}/article/${p.slug}</link>
      <description><![CDATA[${p.excerpt || p.content_html?.substring(0, 200) || ''}]]></description>
      <pubDate>${new Date(p.published_at || p.created_at).toUTCString()}</pubDate>
      <guid>${baseUrl}/article/${p.slug}</guid>
    </item>`).join('')

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteTitle}</title>
    <link>${baseUrl}</link>
    <description>${siteDesc}</description>
    <atom:link href="${baseUrl}/api/rss" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`

  res.set('Content-Type', 'application/rss+xml; charset=utf-8')
  return res.send(rssXml)
}
