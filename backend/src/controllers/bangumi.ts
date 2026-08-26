import { Response } from 'express'
import db from '../config/database'
import { success, error } from '../utils/response'
import { AuthRequest } from '../middleware/auth'
import {
  attachPlaySources,
  deletePlaySource,
  insertPlaySource,
  listPlaySources,
  normalizePlaySources,
  replacePlaySources,
  updatePlaySource,
} from '../services/bangumi-play-sources'

// api.bangumi.lol currently rejects non-browser User-Agent values at its edge.
const BANGUMI_APP_USER_AGENT = 'new-blog/1.0.0 (https://github.com/3137283455/new-blog)'
const BANGUMI_BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type BangumiSearchSourceKey = 'bangumi_lol' | 'official'
type BangumiSearchProvider = {
  key: BangumiSearchSourceKey
  label: string
  apiBase: string
  pageBase: string
}

const DEFAULT_BANGUMI_SEARCH_SOURCE: BangumiSearchSourceKey = 'bangumi_lol'
const BANGUMI_SEARCH_PROVIDERS: Record<BangumiSearchSourceKey, BangumiSearchProvider> = {
  bangumi_lol: {
    key: 'bangumi_lol',
    label: 'bangumi.lol',
    apiBase: (process.env.BANGUMI_LOL_API_BASE || 'https://api.bangumi.lol').replace(/\/+$/, ''),
    pageBase: (process.env.BANGUMI_LOL_PAGE_BASE || 'https://bangumi.lol').replace(/\/+$/, ''),
  },
  official: {
    key: 'official',
    label: 'Bangumi 官方',
    apiBase: (process.env.BANGUMI_OFFICIAL_API_BASE || 'https://api.bgm.tv').replace(/\/+$/, ''),
    pageBase: (process.env.BANGUMI_OFFICIAL_PAGE_BASE || 'https://bgm.tv').replace(/\/+$/, ''),
  },
}

function cleanBangumiSearchSource(value: unknown): BangumiSearchSourceKey | null {
  const key = cleanText(value, 30)
  return key === 'bangumi_lol' || key === 'official' ? key : null
}

function getBangumiSearchProvider(requested?: unknown) {
  const requestedKey = cleanBangumiSearchSource(requested)
  if (requestedKey) return BANGUMI_SEARCH_PROVIDERS[requestedKey]
  const stored = db.prepare("SELECT value FROM settings WHERE key = 'bangumi_search_source'").get() as any
  const storedKey = cleanBangumiSearchSource(stored?.value) || DEFAULT_BANGUMI_SEARCH_SOURCE
  return BANGUMI_SEARCH_PROVIDERS[storedKey]
}

const selectSql = `
  SELECT id, title, original_title, cover, url, external_id, source, type, total_episodes, play_links, status, progress, rating, season, summary,
         watched_episodes, episode_duration, update_weekday, article_id,
         (SELECT slug FROM articles WHERE articles.id = bangumi_items.article_id) AS article_slug,
         sort_order, is_active, created_at, updated_at
  FROM bangumi_items
`

const LIMITS = {
  title: 100,
  url: 500,
  status: 30,
  progress: 60,
  season: 60,
  summary: 500,
  type: 60,
  sortOrderMin: -9999,
  sortOrderMax: 9999,
}

const allowedStatus = new Set(['watching', 'done', 'plan', 'planned', 'paused', 'dropped'])

function cleanText(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function bangumiHeaders(req: AuthRequest) {
  const incomingUserAgent = cleanText(req.get('user-agent'), 500)
  return {
    'User-Agent': /^Mozilla\/5\.0/i.test(incomingUserAgent) ? incomingUserAgent : BANGUMI_BROWSER_USER_AGENT,
    'X-Application-User-Agent': BANGUMI_APP_USER_AGENT,
    Accept: 'application/json',
  }
}

function cleanSortOrder(value: unknown) {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(LIMITS.sortOrderMin, Math.min(LIMITS.sortOrderMax, Math.trunc(parsed)))
}

function cleanRating(value: unknown) {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(10, parsed))
}

function cleanEpisodes(value: unknown) {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(9999, Math.trunc(parsed)))
}

function cleanStatus(value: unknown) {
  const status = cleanText(value, LIMITS.status) || 'watching'
  return allowedStatus.has(status) ? status : 'watching'
}

export function publicList(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`${selectSql} WHERE is_active = 1 ORDER BY sort_order ASC, id DESC`).all() as any[]
  return success(res, attachPlaySources(rows))
}

export function list(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`${selectSql} ORDER BY sort_order ASC, id DESC`).all() as any[]
  return success(res, attachPlaySources(rows))
}

function normalizeBangumiSubject(item: any, provider: BangumiSearchProvider) {
  const image = item.images?.large || item.images?.common || item.images?.medium || item.images?.small || ''
  const rating = Number(item.rating?.score || 0)
  return {
    external_id: String(item.id || ''),
    source: provider.key,
    source_label: provider.label,
    title: item.name_cn || item.name || '',
    original_title: item.name || '',
    cover: image,
    url: item.id ? `${provider.pageBase}/subject/${item.id}` : '',
    type: item.type_name || String(item.type || ''),
    total_episodes: Number(item.eps || item.total_episodes || 0),
    rating: Number.isFinite(rating) ? rating : 0,
    season: item.date || '',
    summary: item.summary || '',
  }
}

async function fetchJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Source API HTTP ${response.status}: ${text.slice(0, 200)}`)
  }
  return response.json()
}

export async function searchSource(req: AuthRequest, res: Response) {
  const query = cleanText(req.query.q, 100)
  const id = cleanText(req.query.id, 40)
  if (!query && !id) return error(res, '请输入番剧名称或 Bangumi ID')

  const provider = getBangumiSearchProvider(req.query.source)
  const commonHeaders = bangumiHeaders(req)

  try {
    if (id) {
      const subject = await fetchJson(`${provider.apiBase}/v0/subjects/${encodeURIComponent(id)}`, { headers: commonHeaders })
      return success(res, [normalizeBangumiSubject(subject, provider)])
    }

    try {
      const json = await fetchJson(`${provider.apiBase}/v0/search/subjects?limit=12`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...commonHeaders,
        },
        body: JSON.stringify({ keyword: query, filter: { type: [2] } }),
      })
      const items = (json.data || []).map((item: any) => normalizeBangumiSubject(item, provider))
      if (items.length) return success(res, items)
      return error(res, provider.label + ' 没有返回匹配结果', 'SOURCE_EMPTY', 404)
    } catch (err) {
      console.error('Bangumi 搜索失败:', err)
      return error(res, '无法连接 ' + provider.label + ' 数据源', 'SOURCE_UNAVAILABLE', 502)
    }
  } catch (err) {
    console.error('数据源检索失败:', err)
    return error(res, '无法连接番剧数据源', 'SOURCE_UNAVAILABLE', 502)
  }
}

export async function sourceDetail(req: AuthRequest, res: Response) {
  const id = cleanText(req.params.id, 40)
  if (!id) return error(res, 'Bangumi ID 不能为空')
  const provider = getBangumiSearchProvider(req.query.source)
  try {
    const subject = await fetchJson(`${provider.apiBase}/v0/subjects/${encodeURIComponent(id)}`, {
      headers: bangumiHeaders(req),
    })
    return success(res, normalizeBangumiSubject(subject, provider))
  } catch (err) {
    console.error('获取 Bangumi 详情失败:', err)
    return error(res, '无法连接 ' + provider.label + ' 数据源', 'SOURCE_UNAVAILABLE', 502)
  }
}

export function create(req: AuthRequest, res: Response) {
  const { title, original_title, cover, url, external_id, source, type, total_episodes, play_links, play_sources, status, progress, rating, season, summary, sort_order, is_active, watched_episodes, episode_duration, update_weekday, article_id } = req.body
  const safeTitle = cleanText(title, LIMITS.title)
  if (!safeTitle) return error(res, '番剧标题不能为空')
  const sources = normalizePlaySources(play_sources ?? play_links)
  const createItem = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO bangumi_items
        (title, original_title, cover, url, external_id, source, type, total_episodes, play_links, status, progress, rating, season, summary, sort_order, is_active,
         watched_episodes, episode_duration, update_weekday, article_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      safeTitle,
      cleanText(original_title, LIMITS.title),
      cleanText(cover, LIMITS.url),
      cleanText(url, LIMITS.url),
      cleanText(external_id, 40),
      cleanText(source, 40),
      cleanText(type, LIMITS.type),
      cleanEpisodes(total_episodes),
      JSON.stringify(sources),
      cleanStatus(status),
      cleanText(progress, LIMITS.progress),
      cleanRating(rating),
      cleanText(season, LIMITS.season),
      cleanText(summary, LIMITS.summary),
      cleanSortOrder(sort_order),
      is_active === false ? 0 : 1,
      cleanEpisodes(watched_episodes),
      Math.max(1, Math.min(300, cleanEpisodes(episode_duration) || 24)),
      Math.max(0, Math.min(7, cleanEpisodes(update_weekday))),
      Number(article_id) || null,
    )
    const id = Number(result.lastInsertRowid)
    replacePlaySources(id, sources)
    return id
  })
  createItem()
  return success(res, null, '追番已创建')
}

export function update(req: AuthRequest, res: Response) {
  const { title, original_title, cover, url, external_id, source, type, total_episodes, play_links, play_sources, status, progress, rating, season, summary, sort_order, is_active, watched_episodes, episode_duration, update_weekday, article_id } = req.body
  if (title !== undefined && !cleanText(title, LIMITS.title)) return error(res, '番剧标题不能为空')
  const id = Number(req.params.id)
  const suppliedSources = play_sources ?? play_links
  const sources = suppliedSources === undefined ? null : normalizePlaySources(suppliedSources)
  const updateItem = db.transaction(() => {
    const result = db.prepare(`
      UPDATE bangumi_items
      SET title = COALESCE(?, title),
          original_title = COALESCE(?, original_title),
          cover = COALESCE(?, cover),
          url = COALESCE(?, url),
          external_id = COALESCE(?, external_id),
          source = COALESCE(?, source),
          type = COALESCE(?, type),
          total_episodes = COALESCE(?, total_episodes),
          play_links = COALESCE(?, play_links),
          status = COALESCE(?, status),
          progress = COALESCE(?, progress),
          rating = COALESCE(?, rating),
          season = COALESCE(?, season),
          summary = COALESCE(?, summary),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active),
          watched_episodes = COALESCE(?, watched_episodes),
          episode_duration = COALESCE(?, episode_duration),
          update_weekday = COALESCE(?, update_weekday),
          article_id = COALESCE(?, article_id),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title === undefined ? null : cleanText(title, LIMITS.title),
      original_title === undefined ? null : cleanText(original_title, LIMITS.title),
      cover === undefined ? null : cleanText(cover, LIMITS.url),
      url === undefined ? null : cleanText(url, LIMITS.url),
      external_id === undefined ? null : cleanText(external_id, 40),
      source === undefined ? null : cleanText(source, 40),
      type === undefined ? null : cleanText(type, LIMITS.type),
      total_episodes === undefined ? null : cleanEpisodes(total_episodes),
      sources === null ? null : JSON.stringify(sources),
      status === undefined ? null : cleanStatus(status),
      progress === undefined ? null : cleanText(progress, LIMITS.progress),
      rating === undefined ? null : cleanRating(rating),
      season === undefined ? null : cleanText(season, LIMITS.season),
      summary === undefined ? null : cleanText(summary, LIMITS.summary),
      sort_order === undefined ? null : cleanSortOrder(sort_order),
      is_active === undefined ? null : (is_active ? 1 : 0),
      watched_episodes === undefined ? null : cleanEpisodes(watched_episodes),
      episode_duration === undefined ? null : Math.max(1, Math.min(300, cleanEpisodes(episode_duration) || 24)),
      update_weekday === undefined ? null : Math.max(0, Math.min(7, cleanEpisodes(update_weekday))),
      article_id === undefined ? null : (Number(article_id) || null),
      id,
    )
    if (result.changes && sources !== null) replacePlaySources(id, sources)
    return result
  })
  const result = updateItem()
  if (result.changes === 0) return error(res, '追番不存在', 'NOT_FOUND', 404)
  return success(res, null, '追番已更新')
}

export function playSources(req: AuthRequest, res: Response) {
  return success(res, listPlaySources(Number(req.params.id)))
}

export function createPlaySource(req: AuthRequest, res: Response) {
  const bangumiId = Number(req.params.id)
  const item = db.prepare('SELECT id FROM bangumi_items WHERE id = ?').get(bangumiId)
  if (!item) return error(res, '追番不存在', 'NOT_FOUND', 404)
  const created = insertPlaySource(bangumiId, req.body)
  if (!created) return error(res, '播放源名称和地址不能为空')
  return success(res, created, '播放源已新增')
}

export function editPlaySource(req: AuthRequest, res: Response) {
  const updated = updatePlaySource(Number(req.params.id), Number(req.params.sourceId), req.body)
  if (!updated) return error(res, '播放源不存在或地址为空', 'NOT_FOUND', 404)
  return success(res, updated, '播放源已更新')
}

export function removePlaySource(req: AuthRequest, res: Response) {
  const removed = deletePlaySource(Number(req.params.id), Number(req.params.sourceId))
  if (!removed) return error(res, '播放源不存在', 'NOT_FOUND', 404)
  return success(res, null, '播放源已删除')
}

export function remove(req: AuthRequest, res: Response) {
  const result = db.prepare('DELETE FROM bangumi_items WHERE id = ?').run(Number(req.params.id))
  if (result.changes === 0) return error(res, '追番不存在', 'NOT_FOUND', 404)
  return success(res, null, '追番已删除')
}
