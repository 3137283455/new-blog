const API_BASE = process.env.API_BASE_INTERNAL
  ? `${process.env.API_BASE_INTERNAL.replace(/\/$/, '')}/api`
  : (import.meta.env.PUBLIC_API_BASE || 'http://127.0.0.1:3001/api')

const emptyPagination = { page: 1, pageSize: 0, total: 0, totalPages: 0 }

async function apiFetch(input: string | URL) {
  return globalThis.fetch(input, { cache: 'no-store' })
}

export interface Article {
  id: number
  title: string
  slug: string
  content_html?: string
  content?: string
  excerpt?: string
  cover_image?: string
  title_font_family?: string
  title_font_url?: string
  body_font_family?: string
  body_font_url?: string
  category_name?: string
  category_slug?: string
  view_count?: number
  like_count?: number
  comment_count?: number
  published_at?: string | null
  created_at: string
  updated_at?: string
  is_pinned?: boolean
  is_recommended?: boolean
  tags?: { id: number; name: string }[]
  previous?: ArticleSummary | null
  next?: ArticleSummary | null
  related?: ArticleSummary[]
  series_id?: number
  series_order?: number
  series_title?: string
  series_slug?: string
  series_articles?: ArticleSummary[]
  series_position?: number
  music_track_id?: number
  music_title?: string
  music_artist?: string
  music_url?: string
  music_cover?: string
}

export interface ActivePlugin {
  id: string
  name: string
}

export interface ArticleSummary {
  id: number
  title: string
  slug: string
  excerpt?: string
  category_name?: string
  view_count?: number
  published_at?: string | null
  created_at: string
  updated_at?: string
}

export interface MusicTrack {
  id?: number
  title: string
  artist?: string
  url: string
  cover?: string
  lyrics?: string
  playlist?: string
  collection?: string
  article_id?: number
  photo_id?: number
  article_slug?: string
  photo_album_id?: number
}

export interface MusicStats {
  year: number
  recent: Array<MusicTrack & { played_at?: string; plays?: number }>
  top: Array<MusicTrack & { plays?: number }>
  months: Array<{ month: string; plays: number }>
  total: { plays?: number }
}

export interface ArticleSeries {
  id: number
  title: string
  slug: string
  description?: string
  cover?: string
  sort_order?: number
  is_featured?: number | boolean
  status?: string
  article_count?: number
  total_views?: number
  is_novel?: number | boolean
  series_type?: 'article' | 'book' | 'project'
  book_id?: number
  linked_book?: { id:number; title:string; slug:string; cover?:string }
  articles?: ArticleSummary[]
}

export interface PublicSettings {
  site_title?: string
  site_description?: string
  site_author?: string
  site_keywords?: string
  site_language?: string
  footer_text?: string
  site_start_date?: string
  copyright_year?: number
  banner_interval?: number
  allow_search_indexing?: boolean
  enable_rss?: boolean
  enable_json_feed?: boolean
  show_visitor_stats?: boolean
  profile_name?: string
  profile_avatar?: string
  profile_bio?: string
  banner_images?: string[] | string
  posts_per_page?: number
  enable_comments?: boolean
  active_theme?: string
  music_playlist?: MusicTrack[]
  font_library?: Array<{
    name?: string
    family?: string
    url?: string
    type?: string
  }>
  nav_search_engines?: Array<{
    id: string
    name: string
    mark?: string
    url: string
  }>
}

export interface CustomPage {
  id: number
  title: string
  slug: string
  content?: string
  content_html?: string
  template?: string
  status?: string
  created_at?: string
  updated_at?: string
}

export interface NavigationLink {
  id: number
  title: string
  url: string
  description?: string
  category?: string
  icon?: string
  avatar?: string
  workspace?: string
  sort_order?: number
  is_active?: number | boolean
}

export interface BangumiItem {
  id: number
  title: string
  original_title?: string
  cover?: string
  url?: string
  external_id?: string
  source?: string
  type?: string
  total_episodes?: number
  play_links?: string | BangumiPlaySource[]
  play_sources?: BangumiPlaySource[]
  status?: string
  progress?: string
  rating?: number
  season?: string
  summary?: string
  sort_order?: number
  is_active?: number | boolean
  watched_episodes?: number
  episode_duration?: number
  update_weekday?: number
  article_id?: number
  article_slug?: string
}

export interface BangumiPlaySource {
  id?: number
  bangumi_id?: number
  name?: string
  url?: string
  remark?: string
  is_default?: number | boolean
  sort_order?: number
}

export interface MangaReadSource {
  id?: number
  manga_id?: number
  name: string
  url: string
  remark?: string
  is_default?: number | boolean
  sort_order?: number
}
export type ContentSourceKind = 'book' | 'manga' | 'bangumi'
export interface ContentSourceMeta {
  id: string
  label: string
  kinds: ContentSourceKind[]
  read_mode: 'external' | 'html' | 'pages' | 'auto'
  has_explore: boolean
  has_catalog: boolean
  has_reader: boolean
}
export interface ContentSourceItem {
  external_id: string
  source: string
  source_label: string
  title: string
  original_title?: string
  cover?: string
  source_url?: string
  rating?: number
  publication?: string
  description?: string
  author?: string
  type?: string
  total?: number
}
export interface ContentSourceChapter {
  external_id: string
  title: string
  volume?: string
  number?: number
  source_url?: string
}
export async function getContentSourceConfig(kind?: ContentSourceKind) {
  try {
    const suffix = kind ? `?kind=${encodeURIComponent(kind)}` : ''
    const response = await apiFetch(`${API_BASE}/content-sources${suffix}`)
    if (!response.ok) return null
    return (await response.json()).data || null
  } catch { return null }
}
export async function searchContentSources(kind: ContentSourceKind, query: string, source?: string) {
  try {
    const params = new URLSearchParams({ kind, q: query }); if (source) params.set('source', source)
    const response = await apiFetch(`${API_BASE}/content-sources/search?${params}`)
    if (!response.ok) return null
    return (await response.json()).data || null
  } catch { return null }
}
export async function exploreContentSource(kind: ContentSourceKind, source: string, page = 1) {
  try {
    const params = new URLSearchParams({ kind, source, page: String(page) })
    const response = await apiFetch(`${API_BASE}/content-sources/explore?${params}`)
    if (!response.ok) return null
    return (await response.json()).data || null
  } catch { return null }
}
export async function getContentSourceDetail(kind: ContentSourceKind, source: string, id: string) {
  try {
    const response = await apiFetch(`${API_BASE}/content-sources/${encodeURIComponent(kind)}/${encodeURIComponent(source)}/${encodeURIComponent(id)}`)
    if (!response.ok) return null
    return (await response.json()).data || null
  } catch { return null }
}
export async function getContentSourceChapter(kind: ContentSourceKind, source: string, id: string, chapterId: string) {
  try {
    const response = await apiFetch(`${API_BASE}/content-sources/${encodeURIComponent(kind)}/${encodeURIComponent(source)}/${encodeURIComponent(id)}/chapter/${encodeURIComponent(chapterId)}`)
    if (!response.ok) return null
    return (await response.json()).data || null
  } catch { return null }
}
export interface MangaItem {
  id: number
  title: string
  slug: string
  original_title?: string
  author?: string
  cover?: string
  description?: string
  external_id?: string
  source?: string
  source_url?: string
  status?: string
  progress?: string
  rating?: number
  publication?: string
  sort_order?: number
  is_active?: number | boolean
  read_sources?: MangaReadSource[]
  library_type?: 'local' | 'network'
  volume_count?: number
  chapter_count?: number
  volumes?: Array<{
    id:number; manga_id:number; title:string; slug:string; sort_order:number; chapter_count?:number
    chapters?: Array<{id:number; volume_id:number; title:string; slug:string; sort_order:number; page_count?:number}>
  }>
}
export interface AlbumPhoto {
  id: number
  album_id: number
  title?: string
  image: string
  description?: string
  variant?: string
  sort_order?: number
  captured_at?: string
  camera?: string
  photo_location?: string
  story_text?: string
  created_at?: string
}

export interface AlbumItem {
  id: number
  title: string
  description?: string
  cover?: string
  event_date?: string
  location?: string
  icon?: string
  sort_order?: number
  is_active?: number | boolean
  story_mode?: number | boolean
  photos?: AlbumPhoto[]
}

export async function getPublicSettings(): Promise<PublicSettings> {
  try {
    const res = await apiFetch(`${API_BASE}/settings/public`)
    if (!res.ok) return {}
    const json = await res.json()
    return (json.data || {}) as PublicSettings
  } catch {
    return {}
  }
}

export async function getActivePlugins(): Promise<ActivePlugin[]> {
  try {
    const res = await apiFetch(`${API_BASE}/plugins/active`)
    if (!res.ok) return []
    const json = await res.json()
    return (json.data || []) as ActivePlugin[]
  } catch {
    return []
  }
}

export async function getMusicTracks(): Promise<MusicTrack[]> {
  try {
    const res = await apiFetch(`${API_BASE}/music`)
    if (!res.ok) return []
    const json = await res.json()
    return ((json.data || []) as MusicTrack[]).filter((track) => track?.title && track?.url)
  } catch {
    return []
  }
}

export async function getPages(): Promise<CustomPage[]> {
  try {
    const res = await apiFetch(`${API_BASE}/pages`)
    if (!res.ok) return []
    const json = await res.json()
    return (json.data || []) as CustomPage[]
  } catch {
    return []
  }
}

export async function getPage(slug: string): Promise<CustomPage | null> {
  try {
    const res = await apiFetch(`${API_BASE}/pages/${encodeURIComponent(slug)}`)
    if (!res.ok) return null
    const json = await res.json()
    return (json.data as CustomPage) || null
  } catch {
    return null
  }
}

export async function getNavigationLinks(): Promise<NavigationLink[]> {
  try {
    const res = await apiFetch(`${API_BASE}/navigation`)
    if (!res.ok) return []
    const json = await res.json()
    return (json.data || []) as NavigationLink[]
  } catch {
    return []
  }
}

export async function getMusicStats(year?: number): Promise<MusicStats | null> {
  try {
    const query = year ? `?year=${encodeURIComponent(String(year))}` : ''
    const res = await apiFetch(`${API_BASE}/music/stats${query}`)
    if (!res.ok) return null
    const json = await res.json()
    return (json.data || null) as MusicStats | null
  } catch {
    return null
  }
}

export async function getActiveTheme(): Promise<any> {
  try {
    const res = await apiFetch(`${API_BASE}/themes/active`)
    if (!res.ok) return null
    const json = await res.json()
    return json.data || null
  } catch {
    return null
  }
}

export async function getSeries(): Promise<ArticleSeries[]> {
  try {
    const res = await apiFetch(`${API_BASE}/series`)
    if (!res.ok) return []
    const json = await res.json()
    return (json.data || []) as ArticleSeries[]
  } catch {
    return []
  }
}

export async function getSeriesDetail(slug: string): Promise<ArticleSeries | null> {
  try {
    const res = await apiFetch(`${API_BASE}/series/${encodeURIComponent(slug)}`)
    if (!res.ok) return null
    const json = await res.json()
    return json.data as ArticleSeries
  } catch {
    return null
  }
}

export async function getPersonalInsights(year?: number): Promise<any> {
  try {
    const query = year ? `?year=${encodeURIComponent(String(year))}` : ''
    const res = await apiFetch(`${API_BASE}/hub/insights${query}`)
    if (!res.ok) return null
    const json = await res.json()
    return json.data || null
  } catch {
    return null
  }
}

export async function getBangumiItems(): Promise<BangumiItem[]> {
  try {
    const res = await apiFetch(`${API_BASE}/bangumi`)
    if (!res.ok) return []
    const json = await res.json()
    return (json.data || []) as BangumiItem[]
  } catch {
    return []
  }
}

export async function getAlbums(): Promise<AlbumItem[]> {
  try {
    const res = await apiFetch(`${API_BASE}/albums`)
    if (!res.ok) return []
    const json = await res.json()
    return (json.data || []) as AlbumItem[]
  } catch {
    return []
  }
}

export async function getAlbum(id: string | number): Promise<AlbumItem | null> {
  try {
    const res = await apiFetch(`${API_BASE}/albums/${encodeURIComponent(String(id))}`)
    if (!res.ok) return null
    const json = await res.json()
    return (json.data as AlbumItem) || null
  } catch {
    return null
  }
}

export async function getArticles(params: Record<string, string | number> = {}) {
  try {
    const url = new URL(`${API_BASE}/articles`)
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)))
    const res = await apiFetch(url)
    if (!res.ok) return { articles: [], pagination: emptyPagination }
    const json = await res.json()
    const articles = (json.data || []) as Article[]
    return { articles, pagination: json.pagination || emptyPagination }
  } catch {
    return { articles: [], pagination: emptyPagination }
  }
}

export async function getArticle(slug: string) {
  try {
    const res = await apiFetch(`${API_BASE}/articles/${slug}`)
    if (!res.ok) return null
    const json = await res.json()
    return (json.data as Article) || null
  } catch {
    return null
  }
}

export function formatDate(date?: string | null) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export interface BookSummary {
  id: number
  title: string
  slug: string
  author?: string
  description?: string
  cover?: string
  reading_status?: string
  reading_mode?: 'chapters' | 'document' | 'external'
  reading_url?: string
  source_format?: string
  volume_count?: number
  chapter_count?: number
  updated_at?: string
}
export interface BookVolume {
  id: number
  book_id: number
  title: string
  slug: string
  description?: string
  cover?: string
  chapter_count?: number
  chapters?: Array<{ id:number; title:string; slug:string; sort_order:number }>
}
export async function getMangaItems(): Promise<MangaItem[]> {
  try { const res=await apiFetch(API_BASE+'/manga'); if(!res.ok) return []; return (await res.json()).data||[] } catch { return [] }
}
export async function getManga(slug:string): Promise<MangaItem|null> {
  try { const res=await apiFetch(API_BASE+'/manga/'+encodeURIComponent(slug)); if(!res.ok) return null; return (await res.json()).data||null } catch { return null }
}
export async function getMangaChapter(manga:string,volume:string,chapter:string): Promise<any|null> {
  try { const res=await apiFetch(API_BASE+'/manga/'+encodeURIComponent(manga)+'/'+encodeURIComponent(volume)+'/'+encodeURIComponent(chapter)); if(!res.ok) return null; return (await res.json()).data||null } catch { return null }
}
export async function getBooks(): Promise<BookSummary[]> {
  try { const res=await apiFetch(API_BASE+'/books'); if(!res.ok) return []; return (await res.json()).data||[] } catch { return [] }
}
export async function getBook(slug:string): Promise<(BookSummary & {volumes:BookVolume[]})|null> {
  try { const res=await apiFetch(API_BASE+'/books/'+encodeURIComponent(slug)); if(!res.ok) return null; return (await res.json()).data||null } catch { return null }
}
export async function getBookVolume(book:string,volume:string): Promise<{book:BookSummary;volume:BookVolume}|null> {
  try { const res=await apiFetch(API_BASE+'/books/'+encodeURIComponent(book)+'/'+encodeURIComponent(volume)); if(!res.ok) return null; return (await res.json()).data||null } catch { return null }
}
export async function getBookChapter(book:string,volume:string,chapter:string): Promise<any|null> {
  try { const res=await apiFetch(API_BASE+'/books/'+encodeURIComponent(book)+'/'+encodeURIComponent(volume)+'/'+encodeURIComponent(chapter)); if(!res.ok) return null; return (await res.json()).data||null } catch { return null }
}
