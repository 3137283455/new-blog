export interface MangaCollection {
  id?: number
  source: string
  external_id: string
  title: string
  original_title?: string
  author?: string
  cover?: string
  description?: string
  source_url?: string
  publication?: string
  status?: 'reading' | 'finished' | 'planned' | 'paused' | string
  in_shelf: boolean
  is_favorite: boolean
  updated_at?: string
}

export const MANGA_COLLECTION_STORAGE_KEY = 'boke_manga_collections'

export function collectionKey(source: string, externalId: string) { return `${source}\u0000${externalId}` }

function normalize(value: any): MangaCollection | null {
  if (!value?.source || !value?.external_id || !value?.title) return null
  return {
    ...value,
    source: String(value.source),
    external_id: String(value.external_id),
    title: String(value.title),
    in_shelf: Boolean(value.in_shelf),
    is_favorite: Boolean(value.is_favorite),
  }
}

export function readLocalMangaCollections(): MangaCollection[] {
  try {
    const value = JSON.parse(localStorage.getItem(MANGA_COLLECTION_STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value.map(normalize).filter(Boolean) as MangaCollection[] : []
  } catch { return [] }
}

export function findLocalMangaCollection(source: string, externalId: string) {
  return readLocalMangaCollections().find((item) => collectionKey(item.source, item.external_id) === collectionKey(source, externalId)) || null
}

export function saveLocalMangaCollection(input: MangaCollection) {
  const item = normalize({ ...input, updated_at: new Date().toISOString() })
  if (!item) return []
  const items = readLocalMangaCollections().filter((entry) => collectionKey(entry.source, entry.external_id) !== collectionKey(item.source, item.external_id))
  if (item.in_shelf || item.is_favorite) items.unshift(item)
  localStorage.setItem(MANGA_COLLECTION_STORAGE_KEY, JSON.stringify(items.slice(0, 500)))
  return items
}

export function removeLocalMangaCollection(source: string, externalId: string) {
  const items = readLocalMangaCollections().filter((item) => collectionKey(item.source, item.external_id) !== collectionKey(source, externalId))
  localStorage.setItem(MANGA_COLLECTION_STORAGE_KEY, JSON.stringify(items))
  return items
}

export function mergeMangaCollections(...lists: MangaCollection[][]) {
  const merged = new Map<string, MangaCollection>()
  lists.flat().forEach((value) => {
    const item = normalize(value)
    if (item) merged.set(collectionKey(item.source, item.external_id), { ...merged.get(collectionKey(item.source, item.external_id)), ...item })
  })
  return [...merged.values()].filter((item) => item.in_shelf || item.is_favorite)
}

export async function getPrivateMangaCollections(apiBase: string, token: string) {
  const response = await fetch(`${apiBase}/private/manga/collections`, { headers: { 'X-Device-Token': token } })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || !Array.isArray(json.data)) throw new Error(json.message || '无法读取漫画收藏')
  return json.data.map(normalize).filter(Boolean) as MangaCollection[]
}

export async function syncPrivateMangaCollection(apiBase: string, token: string, item: MangaCollection) {
  const response = await fetch(`${apiBase}/private/manga/collections`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Device-Token': token }, body: JSON.stringify(item) })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || !json.data) throw new Error(json.message || '无法同步漫画收藏')
  return normalize(json.data)
}

export async function removePrivateMangaCollection(apiBase: string, token: string, id?: number, key?: Pick<MangaCollection, 'source' | 'external_id'>) {
  const headers = { 'X-Device-Token': token }
  let targetId = id
  if (!targetId && key) {
    targetId = (await getPrivateMangaCollections(apiBase, token)).find((item) => item.source === key.source && item.external_id === key.external_id)?.id
  }
  if (!targetId) return
  const response = await fetch(`${apiBase}/private/manga/collections/${targetId}`, { method: 'DELETE', headers })
  if (response.ok) return
  if (response.status === 404 && key) {
    const remote = (await getPrivateMangaCollections(apiBase, token)).find((item) => item.source === key.source && item.external_id === key.external_id)
    if (remote?.id && remote.id !== targetId) {
      const retry = await fetch(`${apiBase}/private/manga/collections/${remote.id}`, { method: 'DELETE', headers })
      if (retry.ok) return
    }
  }
  throw new Error('无法移除云端漫画收藏')
}
