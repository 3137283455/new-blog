import { Response } from 'express'
import db from '../config/database'
import { AuthRequest } from '../middleware/auth'
import { error, success } from '../utils/response'
import { ensureSearchIndex } from '../services/search-index'

type HubResult = {
  id: string
  kind: 'article' | 'page' | 'navigation' | 'bangumi' | 'album' | 'album-photo' | 'music' | 'book' | 'manga' | 'series'
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

function searchAllLegacy(req: AuthRequest, res: Response) {
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
    SELECT id, title, description, cover, event_date, location,
      COALESCE(NULLIF(latest_photo_at, ''), NULLIF(event_date, ''), created_at) AS album_time
    FROM albums
    WHERE is_active = 1
      AND (title LIKE ? OR description LIKE ? OR location LIKE ?)
    ORDER BY CASE WHEN title LIKE ? THEN 0 ELSE 1 END, album_time DESC, sort_order ASC
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

  const albumPhotos = db.prepare(`
    SELECT p.id, p.album_id, p.title, p.display_name, p.original_name, p.description,
      p.preview_image, p.image, p.captured_at, p.created_at, p.photo_location,
      a.title AS album_title, a.location AS album_location
    FROM album_photos p
    JOIN albums a ON a.id = p.album_id AND a.is_active = 1
    WHERE p.title LIKE ? OR p.display_name LIKE ? OR p.original_name LIKE ?
      OR p.description LIKE ? OR p.photo_location LIKE ? OR a.title LIKE ?
    ORDER BY CASE
      WHEN p.title LIKE ? OR p.display_name LIKE ? OR a.title LIKE ? THEN 0 ELSE 1 END,
      COALESCE(NULLIF(p.captured_at, ''), p.created_at) DESC
    LIMIT ?
  `).all(like, like, like, like, like, like, prefix, prefix, prefix, limit) as any[]
  results.push(...albumPhotos.map((item) => ({
    id: `album-photo-${item.id}`,
    kind: 'album-photo' as const,
    kind_label: '照片',
    title: item.display_name || item.title || item.original_name || '照片',
    subtitle: [item.album_title, item.description || item.album_location || item.photo_location].filter(Boolean).join(' · ') || '相册照片',
    href: `/albums/${item.album_id}#photo-${item.id}`,
    image: item.preview_image || item.image || '',
    meta: item.captured_at || item.created_at,
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

const SEARCH_KIND_LABELS: Record<string, string> = {
  article: '文章', page: '页面', navigation: '网址', bangumi: '追番', album: '相册',
  'album-photo': '照片', music: '音乐', book: '书籍', manga: '漫画', series: '专题',
}

function searchKey(value: unknown) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase().slice(0, 80)
}

function searchLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export function searchAll(req: AuthRequest, res: Response) {
  ensureSearchIndex()
  const query = searchKey(req.query.q)
  if (!query) return success(res, { query: '', results: [], groups: {}, total: 0, index: { ready: true } })
  const kind = String(req.query.kind || '').trim()
  const allowedKinds = new Set(Object.keys(SEARCH_KIND_LABELS))
  const filterKind = allowedKinds.has(kind) ? kind : ''
  const limit = Math.max(1, Math.min(40, Number(req.query.limit) || 24))
  const page = Math.max(1, Math.min(1000, Number(req.query.page) || 1))
  const offset = (page - 1) * limit
  const needle = `%${searchLike(query)}%`
  const prefix = `${searchLike(query)}%`
  const whereKind = filterKind ? ' AND kind = ?' : ''
  const count = db.prepare(`
    SELECT COUNT(*) AS total FROM search_documents
    WHERE is_public = 1 AND (title_key LIKE ? ESCAPE '\\' OR searchable LIKE ? ESCAPE '\\')${whereKind}
  `).get(...(filterKind ? [needle, needle, filterKind] : [needle, needle])) as any
  const rows = db.prepare(`
    SELECT id, kind, source_id, title, subtitle, href, image, meta
    FROM search_documents
    WHERE is_public = 1 AND (title_key LIKE ? ESCAPE '\\' OR searchable LIKE ? ESCAPE '\\')${whereKind}
    ORDER BY
      CASE WHEN title_key = ? THEN 0
           WHEN title_key LIKE ? ESCAPE '\\' THEN 1
           WHEN searchable LIKE ? ESCAPE '\\' THEN 2
           ELSE 3 END,
      CASE kind WHEN 'article' THEN 0 WHEN 'book' THEN 1 WHEN 'manga' THEN 2 WHEN 'bangumi' THEN 3 WHEN 'album' THEN 4 ELSE 5 END,
      CASE WHEN updated_at = '' THEN 1 ELSE 0 END,
      updated_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...(filterKind
    ? [needle, needle, filterKind, query, prefix, needle, limit, offset]
    : [needle, needle, query, prefix, needle, limit, offset])) as any[]
  const results = rows.map((item) => ({
    id: `${item.kind}-${item.source_id}`,
    kind: item.kind,
    kind_label: SEARCH_KIND_LABELS[item.kind] || item.kind,
    title: item.title,
    subtitle: item.subtitle || '',
    href: item.href,
    image: item.image || '',
    meta: item.meta || '',
  }))
  const groups = results.reduce<Record<string, typeof results>>((output, item) => {
    ;(output[item.kind] ||= []).push(item)
    return output
  }, {})
  return success(res, { query: String(req.query.q || '').trim().slice(0, 80), kind: filterKind, results, groups, total: Number(count?.total || 0), page, limit })
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
