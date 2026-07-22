import { Response } from 'express'
import db from '../config/database'
import { success, error, paginationResult } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

function refreshArticleCommentCount(articleId: number) {
  const row = db.prepare(
    "SELECT COUNT(*) as total FROM comments WHERE article_id = ? AND status = 'approved'",
  ).get(articleId) as any
  db.prepare('UPDATE articles SET comment_count = ? WHERE id = ?').run(Number(row?.total || 0), articleId)
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

const COMMENT_LIMITS = {
  author: 40,
  email: 120,
  url: 200,
  content: 2000,
  cooldownSeconds: 30,
}

function isValidEmail(value: string) {
  if (!value) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeUrl(value: string) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`
  return value
}

function isValidUrl(value: string) {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizePage(value: unknown) {
  const page = Number(value)
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function normalizePageSize(value: unknown) {
  const pageSize = Number(value)
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 20
  return Math.min(Math.floor(pageSize), 100)
}

// ===== 公开 =====
export function list(req: AuthRequest, res: Response) {
  const { id } = req.params
  const page = normalizePage(req.query.page)
  const pageSize = normalizePageSize(req.query.pageSize)

  const comments = db.prepare(`
    SELECT * FROM comments WHERE article_id = ? AND status = 'approved'
    ORDER BY created_at ASC LIMIT ? OFFSET ?
  `).all(Number(id), pageSize, (page - 1) * pageSize) as any[]

  // 构建评论树
  const roots: any[] = []
  const map = new Map<number, any>()
  for (const c of comments) {
    map.set(c.id, { ...c, children: [] })
  }
  for (const c of comments) {
    const node = map.get(c.id)
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  }

  const { total } = db.prepare(
    "SELECT COUNT(*) as total FROM comments WHERE article_id = ? AND status = 'approved'"
  ).get(Number(id)) as any

  return success(res, roots, '获取成功', paginationResult(page, pageSize, total))
}

export function create(req: AuthRequest, res: Response) {
  const { id } = req.params
  const { author_name, author_email, author_url, content, parent_id } = req.body
  const articleId = Number(id)
  const safeAuthor = cleanText(author_name)
  const safeEmail = cleanText(author_email)
  const safeUrl = normalizeUrl(cleanText(author_url))
  const safeContent = cleanText(content)
  if (!safeAuthor || !safeContent) return error(res, '昵称和内容不能为空')
  if (safeAuthor.length > COMMENT_LIMITS.author) return error(res, `昵称不能超过 ${COMMENT_LIMITS.author} 个字符`)
  if (safeEmail.length > COMMENT_LIMITS.email) return error(res, `邮箱不能超过 ${COMMENT_LIMITS.email} 个字符`)
  if (safeUrl.length > COMMENT_LIMITS.url) return error(res, `个人网站不能超过 ${COMMENT_LIMITS.url} 个字符`)
  if (safeContent.length > COMMENT_LIMITS.content) return error(res, `评论内容不能超过 ${COMMENT_LIMITS.content} 个字符`)
  if (!isValidEmail(safeEmail)) return error(res, '邮箱格式不正确', 'INVALID_EMAIL', 400)
  if (!isValidUrl(safeUrl)) return error(res, '个人网站需填写有效网址', 'INVALID_URL', 400)
  const enableSetting = db.prepare("SELECT value FROM settings WHERE key = 'enable_comments'").get() as any
  if (enableSetting && (enableSetting.value === 'false' || enableSetting.value === '0')) {
    return error(res, '评论功能已关闭', 'COMMENTS_DISABLED', 403)
  }
  const article = db.prepare(`
    SELECT id FROM articles
    WHERE id = ? AND status = 'published' AND visibility = 'public' AND deleted_at IS NULL
  `).get(articleId)
  if (!article) return error(res, '文章不存在', 'NOT_FOUND', 404)
  const parentId = parent_id ? Number(parent_id) : null
  if (parentId) {
    const parent = db.prepare('SELECT id FROM comments WHERE id = ? AND article_id = ?').get(parentId, articleId)
    if (!parent) return error(res, '回复的评论不存在', 'NOT_FOUND', 404)
  }

  const ip = req.ip || req.socket.remoteAddress || ''
  const recent = db.prepare(`
    SELECT id FROM comments
    WHERE article_id = ? AND ip = ? AND created_at >= datetime('now', ?)
    LIMIT 1
  `).get(articleId, ip, `-${COMMENT_LIMITS.cooldownSeconds} seconds`)
  if (recent) {
    return error(res, `评论提交太频繁，请 ${COMMENT_LIMITS.cooldownSeconds} 秒后再试`, 'COMMENT_RATE_LIMITED', 429)
  }

  // 检查是否需要审核
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'comment_moderation'").get() as any
  const needModeration = setting?.value === 'true'
  const status = needModeration ? 'pending' : 'approved'

  db.prepare(`
    INSERT INTO comments (article_id, parent_id, author_name, author_email, author_url, content, status, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    articleId, parentId, safeAuthor, safeEmail, safeUrl,
    safeContent, status,
    ip,
    req.headers['user-agent'] || ''
  )

  refreshArticleCommentCount(articleId)

  const msg = needModeration ? '评论已提交，审核通过后显示' : '评论成功'
  return success(res, null, msg)
}

// ===== 管理 =====
export function adminList(req: AuthRequest, res: Response) {
  const page = normalizePage(req.query.page)
  const pageSize = normalizePageSize(req.query.pageSize)
  const status = req.query.status as string

  let where = '1=1'
  const params: any[] = []
  if (status) { where += ' AND c.status = ?'; params.push(status) }

  const comments = db.prepare(`
    SELECT c.*, a.title as article_title
    FROM comments c LEFT JOIN articles a ON c.article_id = a.id
    WHERE ${where}
    ORDER BY c.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, pageSize, (page - 1) * pageSize)

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM comments c WHERE ${where}`).get(...params) as any

  return success(res, comments, '获取成功', paginationResult(page, pageSize, total))
}

export function updateStatus(req: AuthRequest, res: Response) {
  const { id } = req.params
  const { status } = req.body
  if (!['pending', 'approved', 'spam'].includes(status)) {
    return error(res, '无效的状态')
  }
  const comment = db.prepare('SELECT article_id FROM comments WHERE id = ?').get(Number(id)) as any
  if (!comment) return error(res, '评论不存在', 'NOT_FOUND', 404)
  const result = db.prepare('UPDATE comments SET status = ? WHERE id = ?').run(status, Number(id))
  if (result.changes !== 0) refreshArticleCommentCount(Number(comment.article_id))
  if (result.changes === 0) return error(res, '评论不存在', 'NOT_FOUND', 404)
  return success(res, null, '状态已更新')
}

export function remove(req: AuthRequest, res: Response) {
  const { id } = req.params
  const comment = db.prepare('SELECT article_id FROM comments WHERE id = ?').get(Number(id)) as any
  if (!comment) return error(res, '评论不存在', 'NOT_FOUND', 404)
  const result = db.prepare('DELETE FROM comments WHERE id = ?').run(Number(id))
  if (result.changes !== 0) refreshArticleCommentCount(Number(comment.article_id))
  if (result.changes === 0) return error(res, '评论不存在', 'NOT_FOUND', 404)
  return success(res, null, '评论已删除')
}
