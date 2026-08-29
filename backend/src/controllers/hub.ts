import { Response } from 'express'
import db from '../config/database'
import { AuthRequest } from '../middleware/auth'
import { error, success } from '../utils/response'

type HubResult = {
  id: string
  kind: 'article' | 'page' | 'navigation' | 'bangumi' | 'album' | 'music' | 'book' | 'manga' | 'series'
  kind_label: string
  title: string
  subtitle: string
  href: string
  image?: string
  meta?: string
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

function cleanQuery(value: unknown) {
  return String(value ?? '').trim().slice(0, 80)
}

function encodePath(value: unknown) {
  return encodeURIComponent(String(value ?? ''))
}

export function searchAll(req: AuthRequest, res: Response) {
  const query = cleanQuery(req.query.q)
  if (!query) return success(res, { query: '', results: [], groups: {}, total: 0 })
  const like = `%${escapeLike(query)}%`
  const prefix = `${escapeLike(query)}%`
  const limit = Math.max(1, Math.min(8, Number(req.query.limit) || 5))
  const params = [like, like, prefix, limit]
  const results: HubResult[] = []

  const articles = db.prepare(`
    SELECT id, title, slug, excerpt, cover_image, category_id, published_at, created_at
    FROM articles
    WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL
      AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ?)
    ORDER BY CASE WHEN title LIKE ? THEN 0 ELSE 1 END,
      COALESCE(published_at, created_at) DESC
    LIMIT ?
  `).all(like, like, like, prefix, limit) as any[]
  results.push(...articles.map((item) => ({
    id: `article-${item.id}`,
    kind: 'article' as const,
    kind_label: '文章',
    title: item.title,
    subtitle: item.excerpt || '博客文章',
    href: `/article/${encodePath(item.slug)}`,
    image: item.cover_image || '',
    meta: item.published_at || item.created_at,
  })))

  const pages = db.prepare(`
    SELECT id, title, slug, content, updated_at
    FROM pages
    WHERE status = 'published' AND deleted_at IS NULL
      AND (title LIKE ? OR content LIKE ?)
    ORDER BY CASE WHEN title LIKE ? THEN 0 ELSE 1 END, updated_at DESC
    LIMIT ?
  `).all(...params) as any[]
  results.push(...pages.map((item) => ({
    id: `page-${item.id}`,
    kind: 'page' as const,
    kind_label: '页面',
    title: item.title,
    subtitle: String(item.content || '').replace(/[#*`>\-_\[\]()!]/g, '').slice(0, 100),
    href: `/page/${encodePath(item.slug)}`,
    meta: item.updated_at,
  })))

  const navigation = db.prepare(`
    SELECT id, title, url, description, category, icon, avatar
    FROM navigation_links
    WHERE COALESCE(is_active, 1) != 0
      AND (title LIKE ? OR description LIKE ? OR url LIKE ? OR category LIKE ?)
    ORDER BY CASE WHEN title LIKE ? THEN 0 ELSE 1 END, sort_order ASC, id DESC
    LIMIT ?
  `).all(like, like, like, like, prefix, limit) as any[]
  results.push(...navigation.map((item) => ({
    id: `navigation-${item.id}`,
    kind: 'navigation' as const,
    kind_label: '网址',
    title: item.title,
    subtitle: item.description || item.category || item.url,
    href: item.url,
    image: item.avatar || '',
    meta: item.category || '',
  })))

  const bangumi = db.prepare(`
    SELECT id, title, original_title, cover, summary, status, progress
    FROM bangumi_items
    WHERE is_active = 1
      AND (title LIKE ? OR original_title LIKE ? OR summary LIKE ?)
    ORDER BY CASE WHEN title LIKE ? THEN 0 ELSE 1 END, sort_order ASC, id DESC
    LIMIT ?
  `).all(like, like, like, prefix, limit) as any[]
  results.push(...bangumi.map((item) => ({
    id: `bangumi-${item.id}`,
    kind: 'bangumi' as const,
    kind_label: '追番',
    title: item.title,
    subtitle: item.summary || item.original_title || '追番记录',
    href: '/bangumi',
    image: item.cover || '',
    meta: item.progress || item.status || '',
  })))

  const albums = db.prepare(`
    SELECT id, title, description, cover, event_date, location
    FROM albums
    WHERE is_active = 1
      AND (title LIKE ? OR description LIKE ? OR location LIKE ?)
    ORDER BY CASE WHEN title LIKE ? THEN 0 ELSE 1 END, event_date DESC, sort_order ASC
    LIMIT ?
  `).all(like, like, like, prefix, limit) as any[]
  results.push(...albums.map((item) => ({
    id: `album-${item.id}`,
    kind: 'album' as const,
    kind_label: '相册',
    title: item.title,
    subtitle: item.description || item.location || '照片相册',
    href: `/albums/${item.id}`,
    image: item.cover || '',
    meta: [item.event_date, item.location].filter(Boolean).join(' · '),
  })))

  const music = db.prepare(`
    SELECT t.id, t.title, t.artist, t.cover, p.name AS playlist_name
    FROM music_tracks t
    LEFT JOIN music_playlists p ON t.playlist_id = p.id
    WHERE t.is_active = 1
      AND (t.title LIKE ? OR t.artist LIKE ? OR p.name LIKE ?)
    ORDER BY CASE WHEN t.title LIKE ? THEN 0 ELSE 1 END, t.sort_order ASC, t.id DESC
    LIMIT ?
  `).all(like, like, like, prefix, limit) as any[]
  results.push(...music.map((item) => ({
    id: `music-${item.id}`,
    kind: 'music' as const,
    kind_label: '音乐',
    title: item.title,
    subtitle: item.artist || item.playlist_name || '音乐',
    href: '/music',
    image: item.cover || '',
    meta: item.playlist_name || '',
  })))

  const books = db.prepare("SELECT b.id,b.title,b.slug,b.author,b.description,b.cover,(SELECT c.title FROM book_chapters c JOIN book_volumes v ON v.id=c.volume_id WHERE v.book_id=b.id AND c.title LIKE ? ORDER BY v.sort_order,c.sort_order LIMIT 1) chapter_match FROM books b WHERE b.status='published' AND b.deleted_at IS NULL AND (b.title LIKE ? OR b.author LIKE ? OR b.description LIKE ? OR EXISTS(SELECT 1 FROM book_chapters c JOIN book_volumes v ON v.id=c.volume_id WHERE v.book_id=b.id AND (c.title LIKE ? OR c.content_html LIKE ?))) ORDER BY CASE WHEN b.title LIKE ? THEN 0 ELSE 1 END,b.updated_at DESC LIMIT ?").all(like,like,like,like,like,like,prefix,limit) as any[]
  results.push(...books.map((item)=>({id:'book-'+item.id,kind:'book' as const,kind_label:'书籍',title:item.title,subtitle:item.chapter_match?('章节：'+item.chapter_match):(item.description||item.author||'个人书库'),href:'/books/'+encodePath(item.slug),image:item.cover||'',meta:item.author||''})))

  const manga = db.prepare("SELECT id,title,slug,author,original_title,description,cover FROM manga_items WHERE is_active=1 AND (title LIKE ? OR author LIKE ? OR original_title LIKE ? OR description LIKE ?) ORDER BY CASE WHEN title LIKE ? THEN 0 ELSE 1 END,updated_at DESC LIMIT ?").all(like,like,like,like,prefix,limit) as any[]
  results.push(...manga.map((item)=>({id:'manga-'+item.id,kind:'manga' as const,kind_label:'漫画',title:item.title,subtitle:item.description||item.author||'漫画收藏',href:'/manga/'+encodePath(item.slug),image:item.cover||'',meta:'漫画收藏'})))

  const series = db.prepare("SELECT id,title,slug,description,cover,series_type FROM article_series WHERE status='published' AND (title LIKE ? OR description LIKE ?) ORDER BY CASE WHEN title LIKE ? THEN 0 ELSE 1 END,updated_at DESC LIMIT ?").all(like,like,prefix,limit) as any[]
  results.push(...series.map((item)=>({id:'series-'+item.id,kind:'series' as const,kind_label:'专题',title:item.title,subtitle:item.description||'内容专题',href:'/series/'+encodePath(item.slug),image:item.cover||'',meta:item.series_type||''})))
  const groups = results.reduce<Record<string, HubResult[]>>((output, item) => {
    ;(output[item.kind] ||= []).push(item)
    return output
  }, {})
  return success(res, { query, results, groups, total: results.length })
}

export function memories(req: AuthRequest, res: Response) {
  const now = new Date()
  const requested = String(req.query.date || '')
  const monthDay = /^\d{2}-\d{2}$/.test(requested)
    ? requested
    : `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const currentYear = now.getFullYear()

  const articleRows = db.prepare(`
    SELECT id, title, slug, excerpt, cover_image, published_at, created_at
    FROM articles
    WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL
      AND strftime('%m-%d', COALESCE(published_at, created_at)) = ?
      AND CAST(strftime('%Y', COALESCE(published_at, created_at)) AS INTEGER) < ?
    ORDER BY COALESCE(published_at, created_at) DESC
    LIMIT 6
  `).all(monthDay, currentYear) as any[]
  const albumRows = db.prepare(`
    SELECT id, title, description, cover, event_date, location
    FROM albums
    WHERE is_active = 1 AND event_date != ''
      AND strftime('%m-%d', event_date) = ?
      AND CAST(strftime('%Y', event_date) AS INTEGER) < ?
    ORDER BY event_date DESC
    LIMIT 6
  `).all(monthDay, currentYear) as any[]

  const onThisDay: HubResult[] = [
    ...articleRows.map((item) => ({
      id: `article-${item.id}`,
      kind: 'article' as const,
      kind_label: '旧文章',
      title: item.title,
      subtitle: item.excerpt || '那天写下的文章',
      href: `/article/${encodePath(item.slug)}`,
      image: item.cover_image || '',
      meta: item.published_at || item.created_at,
    })),
    ...albumRows.map((item) => ({
      id: `album-${item.id}`,
      kind: 'album' as const,
      kind_label: '旧相册',
      title: item.title,
      subtitle: item.description || item.location || '那天留下的照片',
      href: `/albums/${item.id}`,
      image: item.cover || '',
      meta: item.event_date,
    })),
  ].sort((left, right) => String(right.meta || '').localeCompare(String(left.meta || '')))

  const randomArticle = db.prepare(`
    SELECT id, title, slug, excerpt, cover_image, published_at, created_at
    FROM articles
    WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL
    ORDER BY RANDOM() LIMIT 4
  `).all() as any[]
  const randomAlbum = db.prepare(`
    SELECT id, title, description, cover, event_date, location
    FROM albums WHERE is_active = 1 ORDER BY RANDOM() LIMIT 2
  `).all() as any[]
  const random: HubResult[] = [
    ...randomArticle.map((item) => ({
      id: `article-${item.id}`,
      kind: 'article' as const,
      kind_label: '随机文章',
      title: item.title,
      subtitle: item.excerpt || '重新读一遍',
      href: `/article/${encodePath(item.slug)}`,
      image: item.cover_image || '',
      meta: item.published_at || item.created_at,
    })),
    ...randomAlbum.map((item) => ({
      id: `album-${item.id}`,
      kind: 'album' as const,
      kind_label: '随机相册',
      title: item.title,
      subtitle: item.description || item.location || '重新看看这些照片',
      href: `/albums/${item.id}`,
      image: item.cover || '',
      meta: item.event_date,
    })),
  ]

  if (!onThisDay.length && !random.length) return error(res, '还没有可以回顾的内容', 'NOT_FOUND', 404)
  return success(res, { date: monthDay, on_this_day: onThisDay, random })
}
