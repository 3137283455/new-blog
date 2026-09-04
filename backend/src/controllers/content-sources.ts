import { Request, Response } from 'express'
import {
  ContentSearchKind,
  detailReadableContentSource,
  exploreContentSource,
  getContentSearchConfig,
  getContentSourceRuleById,
  readContentSource,
  searchContentSource,
} from '../services/content-search-sources'
import { error, success } from '../utils/response'
import {
  detailVeneraSource,
  exploreVeneraSource,
  fetchVeneraImage,
  getVeneraSources,
  publicVeneraSource,
  readVeneraSource,
  searchVeneraSource,
} from '../services/venera-sources'

function clean(value: unknown, max = 500) { return String(value ?? '').trim().slice(0, max) }
function kind(value: unknown): ContentSearchKind | '' {
  const candidate = clean(value, 20)
  return candidate === 'book' || candidate === 'bangumi' || candidate === 'manga' ? candidate : ''
}
function requestHeaders(req: Request) {
  const incoming = clean(req.get('user-agent'), 500)
  return {
    'User-Agent': /^Mozilla\/5\.0/i.test(incoming) ? incoming : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'X-Application-User-Agent': 'new-blog/1.0.0 (https://github.com/3137283455/new-blog)',
  }
}
function publicSource(rule: any) {
  return { id: rule.id, label: rule.label, kinds: rule.kinds, read_mode: rule.read_mode, has_explore: Boolean(rule.explore), has_catalog: Boolean(rule.chapters), has_reader: Boolean(rule.reader) }
}
function publicItem(item: any) {
  return { ...item, author: item.author || '' }
}

export function config(req: Request, res: Response) {
  const requestedKind = kind(req.query.kind)
  const content = getContentSearchConfig()
  const sources = content.sources.filter((source) => source.enabled && (!requestedKind || source.kinds.includes(requestedKind))).map(publicSource)
  if (!requestedKind || requestedKind === 'manga') sources.push(...getVeneraSources().map(publicVeneraSource))
  return success(res, { version: 1, kind: requestedKind || null, default_source: requestedKind ? content.defaults[requestedKind] || '' : '', sources })
}

export async function search(req: Request, res: Response) {
  const requestedKind = kind(req.query.kind), query = clean(req.query.q, 120), requestedSource = clean(req.query.source, 40)
  if (!requestedKind) return error(res, 'kind 必须是 book、bangumi 或 manga', 'INVALID_SOURCE_KIND', 400)
  if (!query) return error(res, '请输入搜索关键词', 'QUERY_REQUIRED', 400)
  try {
    if (requestedSource === 'all') {
      const rules = getContentSearchConfig().sources.filter((source) => source.enabled && source.kinds.includes(requestedKind))
      const venera = requestedKind === 'manga' ? getVeneraSources() : []
      const metas = [...rules.map(publicSource), ...venera.map(publicVeneraSource)]
      const tasks = [
        ...rules.map(async (rule) => (await searchContentSource(requestedKind, query, rule.id, requestHeaders(req), Math.min(20, Math.max(1, Number(req.query.limit) || 12)))).items.map(publicItem)),
        ...venera.map(async (source) => (await searchVeneraSource(source.id, query, 1)).items.map(publicItem)),
      ]
      const settled = await Promise.allSettled(tasks)
      const sources = settled.map((result, index) => result.status === 'fulfilled' ? { ...metas[index], ok: true, count: result.value.length } : { ...metas[index], ok: false, count: 0 })
      const items = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
      if (!items.length) return error(res, sources.some((source) => source.ok) ? '所有漫画源都没有返回匹配结果' : '所有漫画源均请求失败', 'SOURCE_EMPTY', 404)
      return success(res, { aggregate: true, source: null, sources, items })
    }
    if (requestedKind === 'manga' && requestedSource.startsWith('venera:')) {
      const result = await searchVeneraSource(requestedSource, query, Math.max(1, Number(req.query.page) || 1))
      return result.items.length ? success(res, { source: publicVeneraSource(result.record), items: result.items.map(publicItem) }) : error(res, `${result.record.name} 没有返回匹配结果`, 'SOURCE_EMPTY', 404)
    }
    const result = await searchContentSource(requestedKind, query, requestedSource, requestHeaders(req), Math.min(30, Math.max(1, Number(req.query.limit) || 20)))
    return result.items.length ? success(res, { source: publicSource(result.rule), items: result.items.map(publicItem) }) : error(res, `${result.rule.label} 没有返回匹配结果`, 'SOURCE_EMPTY', 404)
  } catch (cause) {
    console.error('内容源检索失败:', cause)
    return error(res, cause instanceof Error ? cause.message : '无法连接内容源', 'SOURCE_UNAVAILABLE', 502)
  }
}

export async function explore(req: Request, res: Response) {
  const requestedKind = kind(req.query.kind), requestedSource = clean(req.query.source, 40)
  if (!requestedKind) return error(res, 'kind 必须是 book、bangumi 或 manga', 'INVALID_SOURCE_KIND', 400)
  try {
    if (requestedKind === 'manga' && requestedSource.startsWith('venera:')) {
      const result = await exploreVeneraSource(requestedSource, Math.max(1, Number(req.query.page) || 1))
      return success(res, { source: publicVeneraSource(result.record), page: Math.max(1, Number(req.query.page) || 1), items: result.items.map(publicItem) })
    }
    const result = await exploreContentSource(requestedKind, requestedSource, requestHeaders(req), Math.max(1, Number(req.query.page) || 1), Math.min(30, Math.max(1, Number(req.query.limit) || 24)))
    return success(res, { source: publicSource(result.rule), page: result.page, items: result.items.map(publicItem) })
  } catch (cause) {
    return error(res, cause instanceof Error ? cause.message : '无法读取内容源探索页', 'SOURCE_EXPLORE_UNAVAILABLE', 502)
  }
}

export async function detail(req: Request, res: Response) {
  const requestedKind = kind(req.params.kind), id = clean(req.params.id, 160), requestedSource = clean(req.params.source, 40)
  if (!requestedKind) return error(res, '内容源类型无效', 'INVALID_SOURCE_KIND', 400)
  if (!id) return error(res, '内容源 ID 不能为空', 'SOURCE_ID_REQUIRED', 400)
  try {
    if (requestedKind === 'manga' && requestedSource.startsWith('venera:')) {
      const result = await detailVeneraSource(requestedSource, id)
      return success(res, { source: publicVeneraSource(result.record), item: publicItem(result.item), chapters: result.chapters, can_read: true, read_mode: 'pages' })
    }
    const result = await detailReadableContentSource(requestedKind, id, requestedSource, requestHeaders(req))
    return success(res, { source: publicSource(result.rule), item: publicItem(result.item), chapters: result.chapters, can_read: Boolean(result.rule.reader), read_mode: result.rule.read_mode })
  } catch (cause) {
    console.error('内容源详情读取失败:', cause)
    return error(res, cause instanceof Error ? cause.message : '无法读取内容源详情', 'SOURCE_UNAVAILABLE', 502)
  }
}

export async function chapter(req: Request, res: Response) {
  const requestedKind = kind(req.params.kind), id = clean(req.params.id, 160), chapterId = clean(req.params.chapterId, 160), requestedSource = clean(req.params.source, 40)
  if (!requestedKind) return error(res, '内容源类型无效', 'INVALID_SOURCE_KIND', 400)
  if (!id || !chapterId) return error(res, '内容源章节 ID 不能为空', 'CHAPTER_ID_REQUIRED', 400)
  try {
    if (requestedKind === 'manga' && requestedSource.startsWith('venera:')) {
      const result = await readVeneraSource(requestedSource, id, chapterId)
      return success(res, { source: publicVeneraSource(result.record), reader: result.reader, kind: requestedKind })
    }
    const result = await readContentSource(requestedKind, id, chapterId, requestedSource, requestHeaders(req))
    return success(res, { source: publicSource(result.rule), reader: result.reader, kind: requestedKind })
  } catch (cause) {
    console.error('内容源章节读取失败:', cause)
    return error(res, cause instanceof Error ? cause.message : '无法读取内容源章节', 'SOURCE_UNAVAILABLE', 502)
  }
}

export async function media(req: Request, res: Response) {
  const sourceId = clean(req.query.source, 40), targetValue = clean(req.query.url, 2000), requestedKind = kind(req.query.kind) || undefined
  if (!sourceId || !targetValue) return error(res, 'source 和 url 不能为空', 'SOURCE_MEDIA_REQUIRED', 400)
  try {
    if (sourceId.startsWith('venera:')) {
      const response = await fetchVeneraImage(sourceId, targetValue)
      if (!response.ok) return error(res, `Venera 源图片 HTTP ${response.status}`, 'SOURCE_MEDIA_FAILED', 502)
      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      if (!contentType.toLowerCase().startsWith('image/')) return error(res, 'Venera 源返回的不是图片', 'SOURCE_MEDIA_INVALID', 502)
      const body = Buffer.from(await response.arrayBuffer())
      if (body.length > 20 * 1024 * 1024) return error(res, 'Venera 源图片超过 20MB 限制', 'SOURCE_MEDIA_TOO_LARGE', 413)
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'public, max-age=3600')
      return res.send(body)
    }
    const rule = getContentSourceRuleById(sourceId, requestedKind)
    const target = new URL(targetValue)
    const allowedOrigins = [rule.api_base, rule.page_base].map((value) => { try { return new URL(value).origin } catch { return '' } }).filter(Boolean)
    if (!/^https?:$/i.test(target.protocol) || !allowedOrigins.includes(target.origin)) return error(res, '图片地址不属于当前检索源允许的站点', 'SOURCE_MEDIA_ORIGIN_DENIED', 403)
    const response = await fetch(target, { headers: { ...requestHeaders(req), ...(rule.headers || {}) }, signal: AbortSignal.timeout(rule.timeout_ms) })
    if (!response.ok) return error(res, `源站图片 HTTP ${response.status}`, 'SOURCE_MEDIA_FAILED', 502)
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    if (!contentType.toLowerCase().startsWith('image/')) return error(res, '源站返回的不是图片', 'SOURCE_MEDIA_INVALID', 502)
    const length = Number(response.headers.get('content-length') || 0)
    if (length > 20 * 1024 * 1024) return error(res, '源站图片超过 20MB 限制', 'SOURCE_MEDIA_TOO_LARGE', 413)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.send(Buffer.from(await response.arrayBuffer()))
  } catch (cause) {
    return error(res, cause instanceof Error ? cause.message : '源站图片读取失败', 'SOURCE_MEDIA_FAILED', 502)
  }
}
