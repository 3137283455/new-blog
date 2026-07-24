import { Response } from 'express'
import db from '../config/database'
import { success, error } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

// Bangumi API 配置常量
const BANGUMI_TOKEN = 'W8ydqHB8wPGoID7U2S9ed1j8G9gj9Wu53bwbWonA'
// 根据 Bangumi 规范：使用符合格式的 User-Agent（包含 GitHub 地址/应用名称等）
const BANGUMI_USER_AGENT = 'new-blog/1.0.0 (https://github.com/3137283455/new-blog)'

const selectSql = `
  SELECT id, title, original_title, cover, url, external_id, source, type, total_episodes, play_links, status, progress, rating, season, summary,
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
  playLinks: 3000,
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

function cleanPlayLinks(value: unknown) {
  let links = value
  if (typeof value === 'string') {
    try {
      links = JSON.parse(value)
    } catch {
      links = value
        .split(/\r?\n/)
        .map((line) => {
          const [name, ...urlParts] = line.split('|')
          return { name: name?.trim() || '播放链接', url: urlParts.join('|').trim() }
        })
    }
  }
  if (!Array.isArray(links)) return '[]'
  return JSON.stringify(links
    .map((link) => ({
      name: cleanText((link as any)?.name || '播放链接', 60),
      url: cleanText((link as any)?.url, LIMITS.url),
      remark: cleanText((link as any)?.remark, 120),
    }))
    .filter((link) => link.url)
    .slice(0, 20))
    .slice(0, LIMITS.playLinks)
}

function cleanStatus(value: unknown) {
  const status = cleanText(value, LIMITS.status) || 'watching'
  return allowedStatus.has(status) ? status : 'watching'
}

export function publicList(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`${selectSql} WHERE is_active = 1 ORDER BY sort_order ASC, id DESC`).all()
  return success(res, rows)
}

export function list(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`${selectSql} ORDER BY sort_order ASC, id DESC`).all()
  return success(res, rows)
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
    url: item.id ? `https://bgm.tv/subject/${item.id}` : '',
    type: item.type_name || String(item.type || ''),
    total_episodes: Number(item.eps || item.total_episodes || 0),
    rating: Number.isFinite(rating) ? rating : 0,
    season: item.date || '',
    summary: item.summary || '',
  }
}

export async function searchSource(req: AuthRequest, res: Response) {
  const query = cleanText(req.query.q, 100)
  const id = cleanText(req.query.id, 40)
  if (!query && !id) return error(res, '请输入番剧名称或 Bangumi ID')
  try {
    const commonHeaders = {
      'User-Agent': BANGUMI_USER_AGENT,
      'Authorization': `Bearer ${BANGUMI_TOKEN}`,
      'Accept': 'application/json'
    }

    if (id) {
      const response = await fetch(`https://api.bgm.tv/v0/subjects/${encodeURIComponent(id)}`, {
        headers: commonHeaders,
      })
      if (!response.ok) return error(res, 'Bangumi ID 查询失败', 'SOURCE_ERROR', response.status)
      return success(res, [normalizeBangumiSubject(await response.json())])
    }
    const response = await fetch('https://api.bgm.tv/v0/search/subjects?limit=12', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        ...commonHeaders 
      },
      body: JSON.stringify({ keyword: query, filter: { type: [2] } }),
    })
    if (!response.ok) return error(res, 'Bangumi 数据源检索失败', 'SOURCE_ERROR', response.status)
    const json = await response.json()
    return success(res, (json.data || []).map(normalizeBangumiSubject))
  } catch {
    return error(res, '无法连接 Bangumi 数据源', 'SOURCE_UNAVAILABLE', 502)
  }
}

export async function sourceDetail(req: AuthRequest, res: Response) {
  const id = cleanText(req.params.id, 40)
  if (!id) return error(res, 'Bangumi ID 不能为空')
  try {
    const response = await fetch(`https://api.bgm.tv/v0/subjects/${encodeURIComponent(id)}`, {
      headers: {
        'User-Agent': BANGUMI_USER_AGENT,
        'Authorization': `Bearer ${BANGUMI_TOKEN}`,
        'Accept': 'application/json'
      },
    })
    if (!response.ok) return error(res, 'Bangumi ID 查询失败', 'SOURCE_ERROR', response.status)
    return success(res, normalizeBangumiSubject(await response.json()))
  } catch {
    return error(res, '无法连接 Bangumi 数据源', 'SOURCE_UNAVAILABLE', 502)
  }
}

export function create(req: AuthRequest, res: Response) {
  const { title, original_title, cover, url, external_id, source, type, total_episodes, play_links, status, progress, rating, season, summary, sort_order, is_active } = req.body
  const safeTitle = cleanText(title, LIMITS.title)
  if (!safeTitle) return error(res, '番剧标题不能为空')
  db.prepare(`
    INSERT INTO bangumi_items
      (title, original_title, cover, url, external_id, source, type, total_episodes, play_links, status, progress, rating, season, summary, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    safeTitle,
    cleanText(original_title, LIMITS.title),
    cleanText(cover, LIMITS.url),
    cleanText(url, LIMITS.url),
    cleanText(external_id, 40),
    cleanText(source, 40),
    cleanText(type, LIMITS.type),
    cleanEpisodes(total_episodes),
    cleanPlayLinks(play_links),
    cleanStatus(status),
    cleanText(progress, LIMITS.progress),
    cleanRating(rating),
    cleanText(season, LIMITS.season),
    cleanText(summary, LIMITS.summary),
    cleanSortOrder(sort_order),
    is_active === false ? 0 : 1,
  )
  return success(res, null, '追番已创建')
}

export function update(req: AuthRequest, res: Response) {
  const { title, original_title, cover, url, external_id, source, type, total_episodes, play_links, status, progress, rating, season, summary, sort_order, is_active } = req.body
  if (title !== undefined && !cleanText(title, LIMITS.title)) return error(res, '番剧标题不能为空')
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
    play_links === undefined ? null : cleanPlayLinks(play_links),
    status === undefined ? null : cleanStatus(status),
    progress === undefined ? null : cleanText(progress, LIMITS.progress),
    rating === undefined ? null : cleanRating(rating),
    season === undefined ? null : cleanText(season, LIMITS.season),
    summary === undefined ? null : cleanText(summary, LIMITS.summary),
    sort_order === undefined ? null : cleanSortOrder(sort_order),
    is_active === undefined ? null : (is_active ? 1 : 0),
    Number(req.params.id),
  )
  if (result.changes === 0) return error(res, '追番不存在', 'NOT_FOUND', 404)
  return success(res, null, '追番已更新')
}

export function remove(req: AuthRequest, res: Response) {
  const result = db.prepare('DELETE FROM bangumi_items WHERE id = ?').run(Number(req.params.id))
  if (result.changes === 0) return error(res, '追番不存在', 'NOT_FOUND', 404)
  return success(res, null, '追番已删除')
}