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
  excerpt?: string
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
  is_pinned?: boolean
  is_recommended?: boolean
  tags?: { id: number; name: string }[]
}

export interface MusicTrack {
  title: string
  artist?: string
  url: string
  cover?: string
  lyrics?: string
  playlist?: string
  collection?: string
}

export interface PublicSettings {
  site_title?: string
  site_description?: string
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
  sort_order?: number
  is_active?: number | boolean
}

export interface BangumiItem {
  id: number
  title: string
  original_title?: string
  cover?: string
  url?: string
  status?: string
  progress?: string
  rating?: number
  season?: string
  summary?: string
  sort_order?: number
  is_active?: number | boolean
}

export interface AlbumPhoto {
  id: number
  album_id: number
  title?: string
  image: string
  description?: string
  variant?: string
  sort_order?: number
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
