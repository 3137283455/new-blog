import db from '../config/database'

export type SearchKind =
  | 'article'
  | 'page'
  | 'navigation'
  | 'bangumi'
  | 'album'
  | 'album-photo'
  | 'music'
  | 'book'
  | 'manga'
  | 'series'

type SearchRow = {
  kind: SearchKind
  source_id: number
  title: string
  subtitle?: string
  searchable?: string
  href: string
  image?: string
  meta?: string
  is_public: number
  updated_at?: string
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function plain(value: unknown) {
  return text(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>\-_[\]()]\s?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function key(value: unknown) {
  return text(value).normalize('NFKC').toLocaleLowerCase()
}

function row(data: SearchRow) {
  const title = text(data.title) || '未命名内容'
  const subtitle = plain(data.subtitle)
  const searchable = [title, subtitle, plain(data.searchable)].filter(Boolean).join(' ')
  return {
    kind: data.kind,
    source_id: data.source_id,
    title,
    title_key: key(title),
    subtitle,
    searchable: key(searchable),
    href: data.href,
    image: text(data.image),
    meta: text(data.meta),
    is_public: data.is_public ? 1 : 0,
    updated_at: text(data.updated_at),
  }
}

function insertRows() {
  const insert = db.prepare(`
    INSERT INTO search_documents
      (kind, source_id, title, title_key, subtitle, searchable, href, image, meta, is_public, updated_at)
    VALUES (@kind, @source_id, @title, @title_key, @subtitle, @searchable, @href, @image, @meta, @is_public, @updated_at)
    ON CONFLICT(kind, source_id) DO UPDATE SET
      title = excluded.title,
      title_key = excluded.title_key,
      subtitle = excluded.subtitle,
      searchable = excluded.searchable,
      href = excluded.href,
      image = excluded.image,
      meta = excluded.meta,
      is_public = excluded.is_public,
      updated_at = excluded.updated_at
  `)

  const add = (data: SearchRow) => insert.run(row(data))

  const articles = db.prepare(`
    SELECT a.id, a.title, a.slug, a.excerpt, a.content, a.cover_image,
      a.status, a.visibility, a.deleted_at, a.published_at, a.created_at, a.updated_at,
      c.name AS category_name,
      (SELECT GROUP_CONCAT(t.name, ' ') FROM article_tags at2 JOIN tags t ON t.id = at2.tag_id WHERE at2.article_id = a.id) AS tag_names
    FROM articles a
    LEFT JOIN categories c ON c.id = a.category_id
  `).all() as any[]
  articles.forEach((item) => add({
    kind: 'article', source_id: item.id, title: item.title,
    subtitle: [item.excerpt, item.category_name].filter(Boolean).join(' · '),
    searchable: [item.content, item.tag_names].filter(Boolean).join(' '),
    href: `/article/${encodeURIComponent(item.slug)}`, image: item.cover_image,
    meta: item.published_at || item.created_at, updated_at: item.updated_at || item.published_at,
    is_public: item.status === 'published' && item.visibility === 'public' && !item.deleted_at ? 1 : 0,
  }))

  const pages = db.prepare('SELECT id, title, slug, content, status, deleted_at, updated_at FROM pages').all() as any[]
  pages.forEach((item) => add({
    kind: 'page', source_id: item.id, title: item.title, searchable: item.content,
    href: `/page/${encodeURIComponent(item.slug)}`, meta: item.updated_at, updated_at: item.updated_at,
    is_public: item.status === 'published' && !item.deleted_at ? 1 : 0,
  }))

  const navigation = db.prepare('SELECT id, title, url, description, category, icon, avatar, is_active FROM navigation_links').all() as any[]
  navigation.forEach((item) => add({
    kind: 'navigation', source_id: item.id, title: item.title,
    subtitle: item.description || item.category || item.url,
    searchable: [item.url, item.category].filter(Boolean).join(' '), href: item.url,
    image: item.avatar, meta: item.category, updated_at: '', is_public: item.is_active !== 0 ? 1 : 0,
  }))

  const bangumi = db.prepare('SELECT id, title, original_title, cover, summary, status, progress, is_active, updated_at FROM bangumi_items').all() as any[]
  bangumi.forEach((item) => add({
    kind: 'bangumi', source_id: item.id, title: item.title,
    subtitle: item.summary || item.original_title || '追番记录', searchable: item.original_title,
    href: `/bangumi#bangumi-${item.id}`, image: item.cover, meta: item.progress || item.status,
    updated_at: item.updated_at, is_public: item.is_active !== 0 ? 1 : 0,
  }))

  const albums = db.prepare(`
    SELECT id, title, description, cover, event_date, location, latest_photo_at, created_at, updated_at, is_active
    FROM albums
  `).all() as any[]
  albums.forEach((item) => add({
    kind: 'album', source_id: item.id, title: item.title,
    subtitle: item.description || item.location || '照片相册', searchable: item.location,
    href: `/albums/${item.id}`, image: item.cover,
    meta: [item.event_date, item.location].filter(Boolean).join(' · '),
    updated_at: item.updated_at || item.latest_photo_at, is_public: item.is_active !== 0 ? 1 : 0,
  }))

  const albumPhotos = db.prepare(`
    SELECT p.id, p.album_id, p.title, p.display_name, p.original_name, p.description,
      p.preview_image, p.image, p.captured_at, p.created_at, p.updated_at, p.photo_location,
      a.title AS album_title, a.location AS album_location, a.is_active
    FROM album_photos p JOIN albums a ON a.id = p.album_id
  `).all() as any[]
  albumPhotos.forEach((item) => add({
    kind: 'album-photo', source_id: item.id,
    title: item.display_name || item.title || item.original_name || '照片',
    subtitle: [item.album_title, item.description || item.album_location || item.photo_location].filter(Boolean).join(' · '),
    searchable: [item.original_name, item.photo_location].filter(Boolean).join(' '),
    href: `/albums/${item.album_id}#photo-${item.id}`, image: item.preview_image || item.image,
    meta: item.captured_at || item.created_at, updated_at: item.updated_at || item.captured_at,
    is_public: item.is_active !== 0 ? 1 : 0,
  }))

  const music = db.prepare(`
    SELECT t.id, t.title, t.artist, t.cover, t.is_active, t.updated_at, p.name AS playlist_name
    FROM music_tracks t LEFT JOIN music_playlists p ON p.id = t.playlist_id
  `).all() as any[]
  music.forEach((item) => add({
    kind: 'music', source_id: item.id, title: item.title,
    subtitle: item.artist || item.playlist_name || '音乐', searchable: item.playlist_name,
    href: `/music#music-track-${item.id}`, image: item.cover, meta: item.playlist_name,
    updated_at: item.updated_at, is_public: item.is_active !== 0 ? 1 : 0,
  }))

  const books = db.prepare('SELECT id, title, slug, author, description, cover, status, deleted_at, updated_at FROM books').all() as any[]
  books.forEach((item) => add({
    kind: 'book', source_id: item.id, title: item.title,
    subtitle: item.description || item.author || '个人书库', searchable: item.author,
    href: `/books/${encodeURIComponent(item.slug)}`, image: item.cover, meta: item.author,
    updated_at: item.updated_at, is_public: item.status === 'published' && !item.deleted_at ? 1 : 0,
  }))

  const manga = db.prepare('SELECT id, title, slug, author, original_title, description, cover, is_active, updated_at FROM manga_items').all() as any[]
  manga.forEach((item) => add({
    kind: 'manga', source_id: item.id, title: item.title,
    subtitle: item.description || item.author || '漫画收藏', searchable: [item.author, item.original_title].filter(Boolean).join(' '),
    href: `/manga/${encodeURIComponent(item.slug)}`, image: item.cover, meta: '漫画收藏',
    updated_at: item.updated_at, is_public: item.is_active !== 0 ? 1 : 0,
  }))

  const series = db.prepare('SELECT id, title, slug, description, cover, status, updated_at FROM article_series').all() as any[]
  series.forEach((item) => add({
    kind: 'series', source_id: item.id, title: item.title, subtitle: item.description || '内容专题',
    href: `/series/${encodeURIComponent(item.slug)}`, image: item.cover, meta: '专题',
    updated_at: item.updated_at, is_public: item.status === 'published' ? 1 : 0,
  }))
}

export function rebuildSearchIndex() {
  const rebuild = db.transaction(() => {
    db.prepare('DELETE FROM search_documents').run()
    insertRows()
    db.prepare("UPDATE search_index_state SET dirty = 0, last_rebuilt_at = datetime('now') WHERE id = 1").run()
  })
  rebuild()
}

export function ensureSearchIndex() {
  const state = db.prepare('SELECT dirty FROM search_index_state WHERE id = 1').get() as { dirty?: number } | undefined
  if (!state || state.dirty) rebuildSearchIndex()
}

export function searchIndexStatus() {
  const state = db.prepare('SELECT * FROM search_index_state WHERE id = 1').get() as any
  const count = db.prepare('SELECT COUNT(*) AS count FROM search_documents WHERE is_public = 1').get() as any
  return { dirty: Boolean(state?.dirty), last_rebuilt_at: state?.last_rebuilt_at || '', public_count: Number(count?.count || 0) }
}
