import { Response } from 'express'
import db from '../config/database'
import { success } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

export function stats(_req: AuthRequest, res: Response) {
  const totalPosts = (db.prepare("SELECT COUNT(*) as cnt FROM articles WHERE status = 'published' AND deleted_at IS NULL").get() as any).cnt
  const totalAll = (db.prepare("SELECT COUNT(*) as cnt FROM articles WHERE deleted_at IS NULL").get() as any).cnt
  const draftPosts = (db.prepare("SELECT COUNT(*) as cnt FROM articles WHERE status = 'draft' AND deleted_at IS NULL").get() as any).cnt
  const trashedPosts = (db.prepare('SELECT COUNT(*) as cnt FROM articles WHERE deleted_at IS NOT NULL').get() as any).cnt
  const totalComments = (db.prepare('SELECT COUNT(*) as cnt FROM comments').get() as any).cnt
  const pendingComments = (db.prepare("SELECT COUNT(*) as cnt FROM comments WHERE status = 'pending'").get() as any).cnt
  const totalViews = (db.prepare('SELECT COALESCE(SUM(view_count), 0) as cnt FROM articles').get() as any).cnt
  const totalLikes = (db.prepare('SELECT COALESCE(SUM(like_count), 0) as cnt FROM articles').get() as any).cnt
  const totalCategories = (db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as any).cnt
  const totalTags = (db.prepare('SELECT COUNT(*) as cnt FROM tags').get() as any).cnt
  const totalMedia = (db.prepare('SELECT COUNT(*) as cnt FROM media WHERE deleted_at IS NULL').get() as any).cnt
  const trashedMedia = (db.prepare('SELECT COUNT(*) as cnt FROM media WHERE deleted_at IS NOT NULL').get() as any).cnt
  const todayVisitors = (db.prepare("SELECT COUNT(*) as cnt FROM visitor_logs WHERE date(created_at) = date('now')").get() as any).cnt

  const recentPosts = db.prepare("SELECT id, title, slug, view_count, created_at FROM articles WHERE status = 'published' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5").all()
  const popularPosts = db.prepare("SELECT id, title, slug, view_count FROM articles WHERE status = 'published' AND deleted_at IS NULL ORDER BY view_count DESC LIMIT 5").all()

  // 异常告警数据
  const memUsage = process.memoryUsage()
  const anomalies: { type: string; message: string; level: string }[] = []
  const rssMB = Math.round(memUsage.rss / 1024 / 1024)
  if (rssMB > 200) anomalies.push({ type: 'memory', message: `内存占用过高：${rssMB}MB`, level: 'warning' })
  if (rssMB > 300) anomalies.push({ type: 'memory', message: `内存严重不足：${rssMB}MB`, level: 'danger' })
  if (pendingComments > 10) anomalies.push({ type: 'comments', message: `${pendingComments} 条评论待审核`, level: 'info' })
  if (totalAll === 0) anomalies.push({ type: 'content', message: '还没有任何文章', level: 'info' })
  if (trashedMedia > 20) anomalies.push({ type: 'media', message: `媒体回收站有 ${trashedMedia} 个文件，可定期确认后永久删除`, level: 'info' })

  return success(res, {
    totalPosts, draftPosts, trashedPosts,
    totalComments, pendingComments,
    totalViews, totalLikes,
    totalCategories, totalTags, totalMedia,
    trashedMedia,
    todayVisitors,
    recentPosts, popularPosts,
    anomalies,
    systemInfo: {
      memoryMB: rssMB,
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version,
    },
  })
}

export function charts(_req: AuthRequest, res: Response) {
  const fillLastDays = (rows: any[], count = 30) => {
    const map = new Map(rows.map((row) => [row.date, Number(row.count || 0)]))
    return Array.from({ length: count }, (_item, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (count - index - 1))
      const key = date.toISOString().slice(0, 10)
      return { date: key, count: map.get(key) || 0 }
    })
  }

  // 最近30天发布趋势
  const publishingTrend = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM articles WHERE created_at >= date('now', '-30 days')
    GROUP BY date(created_at) ORDER BY date ASC
  `).all()

  // 最近30天访问趋势
  const visitTrend = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM visitor_logs WHERE created_at >= date('now', '-30 days')
    GROUP BY date(created_at) ORDER BY date ASC
  `).all()

  // 分类文章分布
  const categoryDistribution = db.prepare(`
    SELECT c.name, COUNT(a.id) as count
    FROM categories c LEFT JOIN articles a ON c.id = a.category_id AND a.status = 'published' AND a.deleted_at IS NULL
    GROUP BY c.id ORDER BY count DESC
  `).all()

  return success(res, {
    publishingTrend: fillLastDays(publishingTrend),
    visitTrend: fillLastDays(visitTrend),
    categoryDistribution,
  })
}

// 公开：今日访客数
export function todayCount(_req: AuthRequest, res: Response) {
  const { cnt } = db.prepare("SELECT COUNT(*) as cnt FROM visitor_logs WHERE date(created_at) = date('now')").get() as any
  const { total } = db.prepare('SELECT COUNT(*) as total FROM visitor_logs').get() as any
  return success(res, { today: cnt, total })
}

export function visitorStats(req: AuthRequest, res: Response) {
  const period = (req.query.period as string) || '7d'
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7

  const stats = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count, COUNT(DISTINCT ip) as unique_visitors
    FROM visitor_logs WHERE created_at >= date('now', ?)
    GROUP BY date(created_at) ORDER BY date ASC
  `).all(`-${days} days`)

  return success(res, stats)
}
