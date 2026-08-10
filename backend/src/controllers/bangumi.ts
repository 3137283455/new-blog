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

// 根据 Bangumi 规范：使用符合格式的 User-Agent（包含 GitHub 地址/应用名称等）
const BANGUMI_USER_AGENT = 'new-blog/1.0.0 (https://github.com/3137283455/new-blog)'
// bangumi.lol mirrors the website; api.bangumi.lol mirrors api.bgm.tv.
// Rewrite the old, incorrect env value so existing deployments recover without
// requiring an immediate manual .env edit.
function resolveBangumiApiBase(value?: string) {
  const base = (value || 'https://api.bangumi.lol').replace(/\/+$/, '')
  try {
    const url = new URL(base)
    if (url.hostname === 'bangumi.lol') url.hostname = 'api.bangumi.lol'
    return url.toString().replace(/\/+$/, '')
  } catch {
    return 'https://api.bangumi.lol'
  }
}

const BANGUMI_API_BASE = resolveBangumiApiBase(process.env.BANGUMI_API_BASE)
const BANGUMI_PAGE_BASE = (process.env.BANGUMI_PAGE_BASE || 'https://bangumi.lol').replace(/\/+$/, '')

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

export function stats(_req: AuthRequest, res: Response) {
  const summary = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN status = 'watching' THEN 1 ELSE 0 END) AS watching,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
      COALESCE(SUM(watched_episodes * episode_duration), 0) AS watched_minutes
    FROM bangumi_items WHERE is_active = 1
  `).get()
  const calendar = db.prepare(`
    SELECT id, title, cover, update_weekday, watched_episodes, total_episodes
    FROM bangumi_items WHERE is_active = 1 AND update_weekday BETWEEN 1 AND 7
    ORDER BY update_weekday ASC, sort_order ASC
  `).all()
  const recommendation = db.prepare(`
    SELECT id, title, cover, summary, watched_episodes, total_episodes
    FROM bangumi_items
    WHERE is_active = 1 AND status IN ('paused', 'plan', 'planned')
    ORDER BY RANDOM() LIMIT 1
  `).get()
  return success(res, { summary, calendar, recommendation })
}

export function incrementProgress(req: AuthRequest, res: Response) {
  const id = Number(req.params.id)
  const item = db.prepare('SELECT id, watched_episodes, total_episodes FROM bangumi_items WHERE id = ? AND is_active = 1').get(id) as any
  if (!item) return error(res, '追番不存在', 'NOT_FOUND', 404)
  const next = Math.min(Math.max(0, Number(item.total_episodes) || 9999), Number(item.watched_episodes || 0) + 1)
  const status = item.total_episodes > 0 && next >= item.total_episodes ? 'done' : 'watching'
  db.prepare("UPDATE bangumi_items SET watched_episodes = ?, progress = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(next, item.total_episodes > 0 ? `${next}/${item.total_episodes}` : String(next), status, id)
  return success(res, { watched_episodes: next, total_episodes: item.total_episodes, status }, '观看进度已更新')
}

function normalizeBangumiSubject(item: any) {
  const image = item.images?.large || item.images?.common || item.images?.medium || item.images?.small || ''
  const rating = Number(item.rating?.score || 0)
  return {
    external_id: String(item.id || ''),
    source: 'bangumi',
    title: item.name_cn || item.name || '',
    original_title: item.name || '',
    cover: image,
    url: item.id ? `${BANGUMI_PAGE_BASE}/subject/${item.id}` : '',
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

  const commonHeaders = {
    'User-Agent': BANGUMI_USER_AGENT,
    Accept: 'application/json',
  }

  try {
    if (id) {
      const subject = await fetchJson(`${BANGUMI_API_BASE}/v0/subjects/${encodeURIComponent(id)}`, { headers: commonHeaders })
      return success(res, [normalizeBangumiSubject(subject)])
    }

    const errors: string[] = []
    try {
      const json = await fetchJson(`${BANGUMI_API_BASE}/v0/search/subjects?limit=12`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...commonHeaders,
        },
        body: JSON.stringify({ keyword: query, filter: { type: [2] } }),
      })
      const items = (json.data || []).map(normalizeBangumiSubject)
      if (items.length) return success(res, items)
    } catch (err) {
      errors.push(`Bangumi v0: ${(err as Error).message}`)
    }

    try {
      const legacy = await fetchJson(`${BANGUMI_API_BASE}/search/subject/${encodeURIComponent(query)}?type=2&responseGroup=small&max_results=12`, { headers: commonHeaders })
      const items = (legacy.list || []).map(normalizeBangumiSubject)
      if (items.length) return success(res, items)
    } catch (err) {
      errors.push(`Bangumi legacy: ${(err as Error).message}`)
    }

    return error(res, `Bangumi 镜像没有返回结果。${errors.join(' | ')}`, 'SOURCE_EMPTY', 502)
  } catch (err) {
    console.error('数据源检索失败:', err)
    return error(res, '无法连接番剧数据源', 'SOURCE_UNAVAILABLE', 502)
  }
}

export async function sourceDetail(req: AuthRequest, res: Response) {
  const id = cleanText(req.params.id, 40)
  if (!id) return error(res, 'Bangumi ID 不能为空')
  try {
    const subject = await fetchJson(`${BANGUMI_API_BASE}/v0/subjects/${encodeURIComponent(id)}`, {
      headers: {
        'User-Agent': BANGUMI_USER_AGENT,
        Accept: 'application/json',
      },
    })
    return success(res, normalizeBangumiSubject(subject))
  } catch (err) {
    console.error('获取 Bangumi 详情失败:', err)
    return error(res, '无法连接 Bangumi 数据源', 'SOURCE_UNAVAILABLE', 502)
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
