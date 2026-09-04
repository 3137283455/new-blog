import db from '../config/database'

export type ContentSearchKind = 'book' | 'bangumi' | 'manga'
export type ContentSourceRequest = { method: 'GET' | 'POST'; path: string; result_path: string; body_type: 'json' | 'form' | 'text'; body?: unknown }
export type ContentSearchRule = {
  id: string
  label: string
  enabled: boolean
  kinds: ContentSearchKind[]
  api_base: string
  page_base: string
  page_path: string
  timeout_ms: number
  headers?: Record<string, string>
  search: ContentSourceRequest
  explore?: ContentSourceRequest
  detail: ContentSourceRequest
  chapters?: ContentSourceRequest
  reader?: ContentSourceRequest
  mapping: Record<string, string | string[]>
  chapter_mapping?: Record<string, string | string[]>
  reader_mapping?: Record<string, string | string[]>
  read_mode: 'external' | 'html' | 'pages' | 'auto'
  type_values: Partial<Record<ContentSearchKind, string | number>>
}
export type ContentSearchConfig = {
  version: 1
  defaults: Partial<Record<ContentSearchKind, string>>
  sources: ContentSearchRule[]
}
export type NormalizedContentSubject = {
  external_id: string
  source: string
  source_label: string
  title: string
  original_title: string
  cover: string
  source_url: string
  rating: number
  publication: string
  description: string
  author: string
  type: string
  total: number
}
export type NormalizedContentChapter = {
  external_id: string
  title: string
  volume: string
  number: number
  source_url: string
}
export type NormalizedContentReader = {
  title: string
  content: string
  content_html: string
  pages: string[]
  source_url: string
}

const builtInRules = (): ContentSearchRule[] => [
  {
    id: 'bangumi_lol', label: 'bangumi.lol', enabled: true, kinds: ['bangumi', 'manga'],
    api_base: (process.env.BANGUMI_LOL_API_BASE || 'https://api.bangumi.lol').replace(/\/+$/, ''),
    page_base: (process.env.BANGUMI_LOL_PAGE_BASE || 'https://bangumi.lol').replace(/\/+$/, ''), page_path: '/subject/{id}', timeout_ms: 10000,
    search: { method: 'POST', path: '/v0/search/subjects?limit={limit}', result_path: 'data', body_type: 'json', body: { keyword: '{query}', filter: { type: ['{type}'] } } },
    detail: { method: 'GET', path: '/v0/subjects/{id}', result_path: '', body_type: 'json' },
    mapping: { id: 'id', title: ['name_cn', 'name'], original_title: 'name', cover: ['images.large', 'images.common', 'images.medium', 'images.small'], rating: 'rating.score', publication: 'date', description: 'summary', type: ['type_name', 'type'], total: ['eps', 'total_episodes'] },
    read_mode: 'external',
    type_values: { bangumi: 2, manga: 1 },
  },
  {
    id: 'official', label: 'Bangumi 官方', enabled: true, kinds: ['bangumi', 'manga'],
    api_base: (process.env.BANGUMI_OFFICIAL_API_BASE || 'https://api.bgm.tv').replace(/\/+$/, ''),
    page_base: (process.env.BANGUMI_OFFICIAL_PAGE_BASE || 'https://bgm.tv').replace(/\/+$/, ''), page_path: '/subject/{id}', timeout_ms: 10000,
    search: { method: 'POST', path: '/v0/search/subjects?limit={limit}', result_path: 'data', body_type: 'json', body: { keyword: '{query}', filter: { type: ['{type}'] } } },
    detail: { method: 'GET', path: '/v0/subjects/{id}', result_path: '', body_type: 'json' },
    mapping: { id: 'id', title: ['name_cn', 'name'], original_title: 'name', cover: ['images.large', 'images.common', 'images.medium', 'images.small'], rating: 'rating.score', publication: 'date', description: 'summary', type: ['type_name', 'type'], total: ['eps', 'total_episodes'] },
    read_mode: 'external',
    type_values: { bangumi: 2, manga: 1 },
  },
]

function clean(value: unknown, max = 500) { return String(value ?? '').trim().slice(0, max) }
function httpUrl(value: unknown) { const url = clean(value, 1000).replace(/\/+$/, ''); return /^https?:\/\//i.test(url) ? url : '' }
function normalizeMapping(value: unknown) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const output: Record<string, string | string[]> = {}
  for (const [key, raw] of Object.entries(input)) {
    if (!/^[a-z_]{1,40}$/i.test(key)) continue
    const paths = (Array.isArray(raw) ? raw : [raw]).map((item) => clean(item, 120)).filter(Boolean).slice(0, 8)
    if (paths.length) output[key] = Array.isArray(raw) ? paths : paths[0]
  }
  return output
}
export function contentSearchRuleErrors(raw: any) {
  const errors: string[] = []
  const id = clean(raw?.id, 80)
  if (!id) errors.push('source.id：不能为空')
  else if (!/^[a-z0-9_-]{1,40}$/i.test(id)) errors.push('source.id：只允许字母、数字、下划线和短横线，最多 40 位')
  if (!clean(raw?.label, 80)) errors.push('source.label：不能为空')
  if (!httpUrl(raw?.api_base)) errors.push('source.api_base：必须是 http/https 地址')
  if (raw?.page_base && !httpUrl(raw.page_base)) errors.push('source.page_base：必须是 http/https 地址')
  const kinds = Array.isArray(raw?.kinds) ? raw.kinds : []
  if (!kinds.some((kind: unknown) => kind === 'book' || kind === 'bangumi' || kind === 'manga')) errors.push('source.kinds：至少选择小说、追番或漫画')
  const searchMethod = clean(raw?.search?.method, 10).toUpperCase()
  if (!['GET', 'POST'].includes(searchMethod)) errors.push('source.search.method：只支持 GET 或 POST')
  if (!clean(raw?.search?.path, 500)) errors.push('source.search.path：不能为空')
  if (!JSON.stringify({ path: raw?.search?.path, body: raw?.search?.body }).includes('{query}')) errors.push('source.search：路径或请求体必须包含 {query}')
  const detailMethod = clean(raw?.detail?.method, 10).toUpperCase()
  if (!['GET', 'POST'].includes(detailMethod)) errors.push('source.detail.method：只支持 GET 或 POST')
  if (!clean(raw?.detail?.path, 500)) errors.push('source.detail.path：不能为空')
  if (!JSON.stringify({ path: raw?.detail?.path, body: raw?.detail?.body }).includes('{id}')) errors.push('source.detail：路径或请求体必须包含 {id}')
  if (!clean(raw?.page_path || '/subject/{id}', 500).includes('{id}')) errors.push('source.page_path：必须包含 {id}')
  const mapping = normalizeMapping(raw?.mapping)
  if (!mapping.id) errors.push('source.mapping.id：必须配置 ID 字段路径')
  if (!mapping.title) errors.push('source.mapping.title：必须配置标题字段路径')
  for (const section of ['search', 'detail']) {
    const bodyType = clean(raw?.[section]?.body_type || 'json', 10)
    if (!['json', 'form', 'text'].includes(bodyType)) errors.push(`source.${section}.body_type：只支持 json、form 或 text`)
  }
  if (raw?.explore) {
    const method = clean(raw.explore.method, 10).toUpperCase()
    if (!['GET', 'POST'].includes(method)) errors.push('source.explore.method：只支持 GET 或 POST')
    if (!clean(raw.explore.path, 500)) errors.push('source.explore.path：不能为空')
    const bodyType = clean(raw.explore.body_type || 'json', 10)
    if (!['json', 'form', 'text'].includes(bodyType)) errors.push('source.explore.body_type：只支持 json、form 或 text')
  }
  if (raw?.chapters) {
    const method = clean(raw.chapters.method, 10).toUpperCase()
    if (!['GET', 'POST'].includes(method)) errors.push('source.chapters.method：只支持 GET 或 POST')
    if (!clean(raw.chapters.path, 500)) errors.push('source.chapters.path：不能为空')
    if (!JSON.stringify({ path: raw.chapters.path, body: raw.chapters.body }).includes('{id}')) errors.push('source.chapters：路径或请求体必须包含 {id}')
    const bodyType = clean(raw.chapters.body_type || 'json', 10)
    if (!['json', 'form', 'text'].includes(bodyType)) errors.push('source.chapters.body_type：只支持 json、form 或 text')
  }
  if (raw?.reader) {
    if (!raw?.chapters) errors.push('source.reader：配置阅读接口前必须先配置 chapters 章节接口')
    const method = clean(raw.reader.method, 10).toUpperCase()
    if (!['GET', 'POST'].includes(method)) errors.push('source.reader.method：只支持 GET 或 POST')
    if (!clean(raw.reader.path, 500)) errors.push('source.reader.path：不能为空')
    if (!JSON.stringify({ path: raw.reader.path, body: raw.reader.body }).includes('{chapter_id}')) errors.push('source.reader：路径或请求体必须包含 {chapter_id}')
    const bodyType = clean(raw.reader.body_type || 'json', 10)
    if (!['json', 'form', 'text'].includes(bodyType)) errors.push('source.reader.body_type：只支持 json、form 或 text')
    const readerMapping = normalizeMapping(raw.reader_mapping)
    if (!readerMapping.content && !readerMapping.pages) errors.push('source.reader_mapping：至少配置 content 或 pages')
  }
  return [...new Set(errors)]
}
function normalizeEndpoint(raw: any): ContentSourceRequest | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const method = clean(raw.method, 10).toUpperCase() === 'POST' ? 'POST' : 'GET'
  const bodyType = ['form', 'text'].includes(clean(raw.body_type, 10)) ? clean(raw.body_type, 10) as 'form' | 'text' : 'json'
  return { method, path: clean(raw.path, 500), result_path: clean(raw.result_path, 160), body_type: bodyType, ...(raw.body === undefined ? {} : { body: raw.body }) }
}
function normalizeRule(raw: any, index: number): ContentSearchRule | null {
  const id = clean(raw?.id || `source-${index + 1}`, 40).toLowerCase().replace(/[^a-z0-9_-]/g, '')
  const label = clean(raw?.label || id, 80)
  const apiBase = httpUrl(raw?.api_base), pageBase = httpUrl(raw?.page_base || raw?.api_base)
  const kindInput: unknown[] = Array.isArray(raw?.kinds) ? raw.kinds : []
  const kinds: ContentSearchKind[] = kindInput.filter((kind): kind is ContentSearchKind => kind === 'book' || kind === 'bangumi' || kind === 'manga')
  const searchMethod = clean(raw?.search?.method, 10).toUpperCase() === 'GET' ? 'GET' : 'POST'
  const detailMethod = clean(raw?.detail?.method, 10).toUpperCase() === 'POST' ? 'POST' : 'GET'
  const searchPath = clean(raw?.search?.path, 500), detailPath = clean(raw?.detail?.path, 500), pagePath = clean(raw?.page_path || '/subject/{id}', 500)
  const searchBodyType = ['form', 'text'].includes(clean(raw?.search?.body_type, 10)) ? clean(raw.search.body_type, 10) as 'form' | 'text' : 'json'
  const detailBodyType = ['form', 'text'].includes(clean(raw?.detail?.body_type, 10)) ? clean(raw.detail.body_type, 10) as 'form' | 'text' : 'json'
  const mapping = normalizeMapping(raw?.mapping)
  const searchTemplate = JSON.stringify({ path: searchPath, body: raw?.search?.body })
  const detailTemplate = JSON.stringify({ path: detailPath, body: raw?.detail?.body })
  const explore = normalizeEndpoint(raw?.explore), chapters = normalizeEndpoint(raw?.chapters), reader = normalizeEndpoint(raw?.reader)
  const chapterMapping = normalizeMapping(raw?.chapter_mapping), readerMapping = normalizeMapping(raw?.reader_mapping)
  const readMode = ['external', 'html', 'pages', 'auto'].includes(clean(raw?.read_mode, 20)) ? clean(raw.read_mode, 20) as ContentSearchRule['read_mode'] : reader ? 'auto' : 'external'
  if (contentSearchRuleErrors(raw).length || !id || !label || !apiBase || !kinds.length || !searchPath || !detailPath || !pagePath || !searchTemplate.includes('{query}') || !detailTemplate.includes('{id}') || !pagePath.includes('{id}') || !mapping.id || !mapping.title) return null
  const headers: Record<string, string> = {}
  if (raw?.headers && typeof raw.headers === 'object' && !Array.isArray(raw.headers)) for (const [key, value] of Object.entries(raw.headers).slice(0, 12)) { const name = clean(key, 80), content = clean(value, 500); if (name && content) headers[name] = content }
  return {
    id, label, enabled: raw?.enabled !== false, kinds: [...new Set(kinds)], api_base: apiBase, page_base: pageBase, page_path: pagePath, timeout_ms: Math.max(1000, Math.min(30000, Math.trunc(Number(raw?.timeout_ms) || 10000))), headers,
    search: { method: searchMethod, path: searchPath, result_path: clean(raw?.search?.result_path, 160), body_type: searchBodyType, ...(raw?.search?.body === undefined ? {} : { body: raw.search.body }) },
    ...(explore ? { explore } : {}),
    detail: { method: detailMethod, path: detailPath, result_path: clean(raw?.detail?.result_path, 160), body_type: detailBodyType, ...(raw?.detail?.body === undefined ? {} : { body: raw.detail.body }) },
    ...(chapters ? { chapters } : {}),
    ...(reader ? { reader } : {}),
    mapping,
    ...(Object.keys(chapterMapping).length ? { chapter_mapping: chapterMapping } : {}),
    ...(Object.keys(readerMapping).length ? { reader_mapping: readerMapping } : {}),
    read_mode: readMode,
    type_values: { ...(raw?.type_values?.book === undefined ? {} : { book: raw.type_values.book }), ...(raw?.type_values?.bangumi === undefined ? {} : { bangumi: raw.type_values.bangumi }), ...(raw?.type_values?.manga === undefined ? {} : { manga: raw.type_values.manga }) },
  }
}
export function normalizeContentSearchConfig(value: unknown): ContentSearchConfig {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as any : {}
  const sourceInput = Array.isArray(input.sources) ? input.sources : builtInRules()
  const ids = new Set<string>()
  const sources: ContentSearchRule[] = sourceInput.slice(0, 24).flatMap((raw: any, index: number): ContentSearchRule[] => { const rule = normalizeRule(raw, index); if (!rule || ids.has(rule.id)) return []; ids.add(rule.id); return [rule] })
  const fallback = builtInRules()
  const usable = sources.length ? sources : (Array.isArray(input.sources) ? [] : fallback)
  const defaults: Partial<Record<ContentSearchKind, string>> = {}
  for (const kind of ['book', 'bangumi', 'manga'] as ContentSearchKind[]) {
    const requested = clean(input?.defaults?.[kind], 40)
    const fallback = usable.find((rule) => rule.enabled && rule.kinds.includes(kind))?.id || ''
    defaults[kind] = usable.some((rule) => rule.id === requested && rule.enabled && rule.kinds.includes(kind)) ? requested : fallback
  }
  return { version: 1, defaults, sources: usable }
}
export function getContentSearchConfig(): ContentSearchConfig {
  const row = db.prepare("SELECT value FROM settings WHERE key='content_search_sources'").get() as any
  if (row?.value) { try { return normalizeContentSearchConfig(JSON.parse(row.value)) } catch {} }
  const legacyBangumi = (db.prepare("SELECT value FROM settings WHERE key='bangumi_search_source'").get() as any)?.value
  const legacyManga = (db.prepare("SELECT value FROM settings WHERE key='manga_search_source'").get() as any)?.value
  return normalizeContentSearchConfig({ version: 1, defaults: { bangumi: legacyBangumi || 'bangumi_lol', manga: legacyManga || 'bangumi_lol' }, sources: builtInRules() })
}
export function saveContentSearchConfig(value: unknown) {
  const config = normalizeContentSearchConfig(value)
  if (!config.defaults.bangumi || !config.defaults.manga) throw new Error('追番与漫画都必须至少保留一个可用检索源')
  db.prepare("INSERT OR REPLACE INTO settings (key,value,type,description) VALUES ('content_search_sources',?,'json','追番与漫画元数据检索规则')").run(JSON.stringify(config))
  return config
}
function pathValue(source: any, path: string) {
  if (!path) return source
  return path.replace(/\[([^\]]+)\]/g, '.$1').split('.').filter(Boolean).reduce((value, key) => value == null ? undefined : value[key], source)
}
function mappedValue(source: any, mapping: Record<string, string | string[]> | undefined, key: string) {
  const paths = mapping?.[key]
  for (const path of Array.isArray(paths) ? paths : [paths]) {
    if (!path) continue
    const value = pathValue(source, path)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return ''
}
function mapped(source: any, rule: ContentSearchRule, key: string) { return mappedValue(source, rule.mapping, key) }
function expand(value: any, variables: Record<string, unknown>, encode = true): any {
  if (typeof value === 'string') {
    const only = value.match(/^\{([a-z_]+)\}$/i)
    if (only) return variables[only[1]] ?? ''
    return value.replace(/\{([a-z_]+)\}/gi, (_all, key) => encode ? encodeURIComponent(String(variables[key] ?? '')) : String(variables[key] ?? ''))
  }
  if (Array.isArray(value)) return value.map((item) => expand(item, variables, encode))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expand(item, variables, encode)]))
  return value
}
function formBody(value: unknown) {
  const params = new URLSearchParams()
  if (value && typeof value === 'object' && !Array.isArray(value)) for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item)) item.forEach((part) => params.append(key, String(part ?? '')))
    else if (item !== undefined && item !== null) params.set(key, typeof item === 'object' ? JSON.stringify(item) : String(item))
  }
  return params.toString()
}
function normalizeCoverUrl(value: unknown, rule: ContentSearchRule) {
  const cover = clean(value, 1000)
  if (!cover) return ''
  if (cover.startsWith('//')) return `https:${cover}`
  if (cover.startsWith('/')) return `${rule.api_base}${cover}`
  return cover
}
function normalizeSubject(item: any, rule: ContentSearchRule): NormalizedContentSubject {
  const id = clean(mapped(item, rule, 'id'), 80), rating = Number(mapped(item, rule, 'rating') || 0), total = Number(mapped(item, rule, 'total') || 0)
  return { external_id: id, source: rule.id, source_label: rule.label, title: clean(mapped(item, rule, 'title'), 200), original_title: clean(mapped(item, rule, 'original_title'), 200), cover: normalizeCoverUrl(mapped(item, rule, 'cover'), rule), source_url: id ? rule.page_base + expand(rule.page_path, { id }) : rule.page_base, rating: Number.isFinite(rating) ? rating : 0, publication: clean(mapped(item, rule, 'publication'), 100), description: clean(mapped(item, rule, 'description'), 5000), author: clean(mapped(item, rule, 'author'), 160), type: clean(mapped(item, rule, 'type'), 100), total: Number.isFinite(total) ? total : 0 }
}
function kindLabel(kind: ContentSearchKind) { return kind === 'book' ? '小说' : kind === 'bangumi' ? '追番' : '漫画' }
export function resolveContentSourceRule(kind: ContentSearchKind, requested?: unknown) {
  const config = getContentSearchConfig(), id = clean(requested, 40) || config.defaults[kind], rule = config.sources.find((item) => item.id === id && item.enabled && item.kinds.includes(kind))
  if (!rule) throw new Error(`检索源 ${id || '(未设置)'} 不可用于${kindLabel(kind)}`)
  return rule
}
export function getContentSourceRuleById(id: string, kind?: ContentSearchKind) {
  const rule = getContentSearchConfig().sources.find((item) => item.id === clean(id, 40) && item.enabled && (!kind || item.kinds.includes(kind)))
  if (!rule) throw new Error(`检索源 ${clean(id, 40) || '(未设置)'} 不存在或已停用`)
  return rule
}
async function requestRule(rule: ContentSearchRule, request: ContentSourceRequest, variables: Record<string, unknown>, baseHeaders: Record<string, string>) {
  const url = rule.api_base + expand(request.path, variables, true)
  const expandedBody = expand(request.body ?? {}, variables, false)
  let body: string | undefined
  let contentType = ''
  if (request.method === 'POST') {
    if (request.body_type === 'form') { body = formBody(expandedBody); contentType = 'application/x-www-form-urlencoded; charset=utf-8' }
    else if (request.body_type === 'text') { body = typeof expandedBody === 'string' ? expandedBody : JSON.stringify(expandedBody); contentType = 'text/plain; charset=utf-8' }
    else { body = JSON.stringify(expandedBody); contentType = 'application/json; charset=utf-8' }
  }
  const response = await fetch(url, { method: request.method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': contentType } : {}), ...baseHeaders, ...rule.headers }, body, signal: AbortSignal.timeout(rule.timeout_ms) })
  const responseText = await response.text()
  if (!response.ok) throw new Error(`${rule.label} HTTP ${response.status}${responseText ? `：${responseText.slice(0, 160)}` : ''}`)
  try { return JSON.parse(responseText) } catch { throw new Error(`${rule.label} 返回的不是有效 JSON`) }
}
export async function searchContentSource(kind: ContentSearchKind, query: string, requested: unknown, baseHeaders: Record<string, string>, limit = 12) { const rule = resolveContentSourceRule(kind, requested), variables = { query, type: rule.type_values[kind] ?? '', limit }; const json = await requestRule(rule, rule.search, variables, baseHeaders); const rows = pathValue(json, rule.search.result_path); return { rule, items: (Array.isArray(rows) ? rows : []).map((item) => normalizeSubject(item, rule)).filter((item) => item.title) } }
export async function exploreContentSource(kind: ContentSearchKind, requested: unknown, baseHeaders: Record<string, string>, page = 1, limit = 24) {
  const rule = resolveContentSourceRule(kind, requested)
  if (!rule.explore) throw new Error(`${rule.label} 没有配置探索页`)
  const json = await requestRule(rule, rule.explore, { page, limit, type: rule.type_values[kind] ?? '' }, baseHeaders)
  const rows = pathValue(json, rule.explore.result_path)
  return { rule, page, items: (Array.isArray(rows) ? rows : []).map((item) => normalizeSubject(item, rule)).filter((item) => item.external_id && item.title) }
}
export async function detailContentSource(kind: ContentSearchKind, id: string, requested: unknown, baseHeaders: Record<string, string>) { const rule = resolveContentSourceRule(kind, requested), json = await requestRule(rule, rule.detail, { id, type: rule.type_values[kind] ?? '' }, baseHeaders), subject = pathValue(json, rule.detail.result_path); return { rule, item: normalizeSubject(subject, rule) } }
function normalizeRemoteUrl(value: unknown, rule: ContentSearchRule) {
  const raw = clean(value, 2000)
  if (!raw) return ''
  if (raw.startsWith('//')) return `https:${raw}`
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('/')) return `${rule.api_base}${raw}`
  return ''
}
function normalizeChapter(item: any, rule: ContentSearchRule): NormalizedContentChapter | null {
  const mapping = rule.chapter_mapping || {}, id = clean(mappedValue(item, mapping, 'id'), 160), title = clean(mappedValue(item, mapping, 'title'), 240)
  if (!id || !title) return null
  const count = Number(mappedValue(item, mapping, 'number'))
  return { external_id: id, title, volume: clean(mappedValue(item, mapping, 'volume'), 120), number: Number.isFinite(count) ? count : 0, source_url: normalizeRemoteUrl(mappedValue(item, mapping, 'url'), rule) }
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char)) }
export function sanitizeRemoteHtml(value: unknown) {
  const source = String(value ?? '').trim()
  if (!source) return ''
  if (!/<[a-z][\s\S]*>/i.test(source)) return source.split(/\n{2,}/).map((part) => `<p>${escapeHtml(part.trim()).replace(/\n/g, '<br>')}</p>`).filter(Boolean).join('')
  return source.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/javascript:/gi, '')
}
function normalizeReader(json: any, rule: ContentSearchRule, chapter: NormalizedContentChapter): NormalizedContentReader {
  const raw = pathValue(json, rule.reader?.result_path || '')
  const mapping = rule.reader_mapping || {}, contentValue = mappedValue(raw, mapping, 'content_html') || mappedValue(raw, mapping, 'content'), pagesValue = mappedValue(raw, mapping, 'pages')
  const pagePath = mapping.page_url || mapping.url || 'url'
  const pageItems = Array.isArray(pagesValue) ? pagesValue : []
  const pages = pageItems.map((item) => typeof item === 'string' ? normalizeRemoteUrl(item, rule) : normalizeRemoteUrl(mappedValue(item, { url: pagePath }, 'url'), rule)).filter(Boolean)
  const content = typeof contentValue === 'string' ? contentValue : contentValue ? JSON.stringify(contentValue) : ''
  return { title: clean(mappedValue(raw, mapping, 'title') || chapter.title, 240), content: content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), content_html: sanitizeRemoteHtml(content), pages, source_url: chapter.source_url || rule.page_base }
}
export async function detailReadableContentSource(kind: ContentSearchKind, id: string, requested: unknown, baseHeaders: Record<string, string>) {
  const detail = await detailContentSource(kind, id, requested, baseHeaders), rule = detail.rule
  let chapters: NormalizedContentChapter[] = []
  if (rule.chapters) {
    const json = await requestRule(rule, rule.chapters, { id, type: rule.type_values[kind] ?? '' }, baseHeaders)
    const rows = pathValue(json, rule.chapters.result_path)
    chapters = (Array.isArray(rows) ? rows : []).map((item) => normalizeChapter(item, rule)).filter((item): item is NormalizedContentChapter => Boolean(item))
  }
  return { ...detail, chapters }
}
export async function readContentSource(kind: ContentSearchKind, id: string, chapterId: string, requested: unknown, baseHeaders: Record<string, string>) {
  const rule = resolveContentSourceRule(kind, requested)
  if (!rule.reader) throw new Error(`${rule.label} 没有配置阅读接口`)
  const json = await requestRule(rule, rule.reader, { id, chapter_id: chapterId, type: rule.type_values[kind] ?? '' }, baseHeaders)
  return { rule, reader: normalizeReader(json, rule, { external_id: chapterId, title: '', volume: '', number: 0, source_url: '' }) }
}
export async function testContentSearchSourceRule(raw: unknown, kind: ContentSearchKind, query: string, id: string, baseHeaders: Record<string, string>) {
  const errors = contentSearchRuleErrors(raw)
  if (errors.length) throw new Error(errors.join('\n'))
  const rule = normalizeRule(raw, 0)
  if (!rule) throw new Error('规则无法规范化，请检查字段格式')
  if (!rule.kinds.includes(kind)) throw new Error(`此规则未启用${kind === 'bangumi' ? '追番' : '漫画'}类型`)
  const startedAt = Date.now()
  if (id) {
    const json = await requestRule(rule, rule.detail, { id, type: rule.type_values[kind] ?? '' }, baseHeaders)
    const item = normalizeSubject(pathValue(json, rule.detail.result_path), rule)
    if (!item.external_id || !item.title) throw new Error('详情请求成功，但 ID 或标题字段映射为空')
    return { source: { id: rule.id, label: rule.label }, mode: 'detail', latency_ms: Date.now() - startedAt, items: [item] }
  }
  if (!query) throw new Error('试跑搜索时请输入关键词')
  const json = await requestRule(rule, rule.search, { query, type: rule.type_values[kind] ?? '', limit: 5 }, baseHeaders)
  const rows = pathValue(json, rule.search.result_path)
  if (!Array.isArray(rows)) throw new Error(`搜索请求成功，但 result_path“${rule.search.result_path || '(根节点)'}”不是数组`)
  const items = rows.map((item) => normalizeSubject(item, rule)).filter((item) => item.external_id && item.title).slice(0, 5)
  if (!items.length) throw new Error('搜索请求成功，但没有得到可用结果；请检查 result_path、mapping.id 和 mapping.title')
  return { source: { id: rule.id, label: rule.label }, mode: 'search', latency_ms: Date.now() - startedAt, items }
}
