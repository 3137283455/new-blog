import db from '../config/database'
import type { SearchKind } from './search-index'

type RelationRow = {
  id: number
  source_type: SearchKind
  source_id: number
  target_type: SearchKind
  target_id: number
  relation_type: string
  note: string
  sort_order: number
}

const labels: Record<string, string> = {
  article: '文章', page: '页面', navigation: '网址', bangumi: '番剧', album: '相册',
  'album-photo': '照片', music: '音乐', book: '书籍', manga: '漫画', series: '专题',
}

function publicTarget(type: string, id: number) {
  switch (type) {
    case 'article': return db.prepare("SELECT id,title,excerpt AS subtitle,slug,cover_image AS image,published_at AS meta FROM articles WHERE id=? AND status='published' AND visibility='public' AND deleted_at IS NULL").get(id) as any
    case 'page': return db.prepare("SELECT id,title,content AS subtitle,slug,updated_at AS meta FROM pages WHERE id=? AND status='published' AND deleted_at IS NULL").get(id) as any
    case 'bangumi': return db.prepare('SELECT id,title,summary AS subtitle,cover AS image,status AS meta FROM bangumi_items WHERE id=? AND is_active=1').get(id) as any
    case 'album': return db.prepare("SELECT id,title,description AS subtitle,cover AS image,COALESCE(NULLIF(latest_photo_at,''),NULLIF(event_date,''),created_at) AS meta FROM albums WHERE id=? AND is_active=1").get(id) as any
    case 'album-photo': return db.prepare("SELECT p.id,p.title,p.description AS subtitle,p.preview_image AS image,COALESCE(NULLIF(p.captured_at,''),p.created_at) AS meta,p.album_id FROM album_photos p JOIN albums a ON a.id=p.album_id WHERE p.id=? AND a.is_active=1").get(id) as any
    case 'music': return db.prepare("SELECT t.id,t.title,t.artist AS subtitle,t.cover AS image,p.name AS meta FROM music_tracks t LEFT JOIN music_playlists p ON p.id=t.playlist_id WHERE t.id=? AND t.is_active=1").get(id) as any
    case 'book': return db.prepare("SELECT id,title,description AS subtitle,slug,cover AS image,updated_at AS meta FROM books WHERE id=? AND status='published' AND deleted_at IS NULL").get(id) as any
    case 'manga': return db.prepare("SELECT id,title,description AS subtitle,slug,cover AS image,updated_at AS meta FROM manga_items WHERE id=? AND is_active=1").get(id) as any
    case 'series': return db.prepare("SELECT id,title,description AS subtitle,slug,cover AS image,updated_at AS meta FROM article_series WHERE id=? AND status='published'").get(id) as any
    default: return null
  }
}

function href(type: string, target: any) {
  if (type === 'article') return `/article/${encodeURIComponent(target.slug)}`
  if (type === 'page') return `/page/${encodeURIComponent(target.slug)}`
  if (type === 'book') return `/books/${encodeURIComponent(target.slug)}`
  if (type === 'manga') return `/manga/${encodeURIComponent(target.slug)}`
  if (type === 'series') return `/series/${encodeURIComponent(target.slug)}`
  if (type === 'album') return `/albums/${target.id}`
  if (type === 'album-photo') return `/albums/${target.album_id}#photo-${target.id}`
  if (type === 'music') return `/music#music-track-${target.id}`
  if (type === 'bangumi') return `/bangumi#bangumi-${target.id}`
  return ''
}

export function publicRelations(type: string, id: number) {
  const rows = db.prepare(`
    SELECT * FROM content_relations
    WHERE (source_type=? AND source_id=?) OR (target_type=? AND target_id=?)
    ORDER BY sort_order ASC, id ASC
  `).all(type, id, type, id) as RelationRow[]

  return rows.flatMap((relation) => {
    const outgoing = relation.source_type === type && relation.source_id === id
    const targetType = outgoing ? relation.target_type : relation.source_type
    const targetId = outgoing ? relation.target_id : relation.source_id
    const target = publicTarget(targetType, targetId)
    if (!target) return []
    return [{
      id: relation.id,
      relation_type: relation.relation_type,
      note: relation.note || '',
      direction: outgoing ? 'outgoing' : 'incoming',
      kind: targetType,
      kind_label: labels[targetType] || targetType,
      title: target.title,
      subtitle: target.subtitle || '',
      href: href(targetType, target),
      image: target.image || '',
      meta: target.meta || '',
    }]
  })
}

export function relationTargetExists(type: string, id: number) {
  const tables: Record<string, string> = {
    article: 'articles', page: 'pages', navigation: 'navigation_links', bangumi: 'bangumi_items',
    album: 'albums', 'album-photo': 'album_photos', music: 'music_tracks', book: 'books',
    manga: 'manga_items', series: 'article_series',
  }
  const table = tables[type]
  return Boolean(table && db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id))
}
