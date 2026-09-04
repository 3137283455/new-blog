import crypto from 'crypto'
import vm from 'vm'
import { load } from 'cheerio'
import db from '../config/database'

export const DEFAULT_VENERA_REPOSITORY = 'https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/index.json'

export type VeneraSourceRecord = {
  id: string
  key: string
  name: string
  version: string
  description: string
  file_name: string
  script_url: string
  repository_url: string
  enabled: boolean
}

export type VeneraRepository = {
  url: string
  name: string
  updated_at: string
  sources: VeneraSourceRecord[]
}

type VeneraRepositoryConfig = { version: 1; repositories: VeneraRepository[] }
type Runtime = { source: any; context: vm.Context; record: VeneraSourceRecord }

const SETTING_KEY = 'venera_source_repositories'
const runtimeCache = new Map<string, Runtime>()
const sourceData = new Map<string, Map<string, unknown>>()
const sourceCookies = new Map<string, Map<string, Array<{ name: string; value: string; domain?: string }>>>()

function clean(value: unknown, max = 500) { return String(value ?? '').trim().slice(0, max) }
function slug(value: unknown) { return clean(value, 120).toLowerCase().replace(/\.js$/i, '').replace(/[^a-z0-9_-]+/g, '-') }
function allowedRepositoryUrl(value: unknown) {
  try {
    const url = new URL(clean(value, 2000))
    if (url.protocol !== 'https:') return ''
    const jsdelivr = url.hostname === 'cdn.jsdelivr.net' && /^\/gh\/venera-app\/venera-configs@[^/]+\/index\.json$/i.test(url.pathname)
    const github = url.hostname === 'raw.githubusercontent.com' && /^\/venera-app\/venera-configs\/[^/]+\/index\.json$/i.test(url.pathname)
    return jsdelivr || github ? url.toString() : ''
  } catch { return '' }
}
function allowedScriptUrl(value: unknown) {
  try {
    const url = new URL(clean(value, 2000))
    if (url.protocol !== 'https:' || !url.pathname.toLowerCase().endsWith('.js')) return ''
    const jsdelivr = url.hostname === 'cdn.jsdelivr.net' && /^\/gh\/venera-app\/venera-configs@[^/]+\//i.test(url.pathname)
    const github = url.hostname === 'raw.githubusercontent.com' && /^\/venera-app\/venera-configs\/[^/]+\//i.test(url.pathname)
    return jsdelivr || github ? url.toString() : ''
  } catch { return '' }
}
function normalizeConfig(value: unknown): VeneraRepositoryConfig {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as any : {}
  const repositories = (Array.isArray(raw.repositories) ? raw.repositories : []).slice(0, 8).flatMap((repository: any) => {
    const url = allowedRepositoryUrl(repository?.url)
    if (!url) return []
    const sources = (Array.isArray(repository?.sources) ? repository.sources : []).slice(0, 100).flatMap((item: any) => {
      const scriptUrl = allowedScriptUrl(item?.script_url)
      const fileName = clean(item?.file_name, 180)
      const id = clean(item?.id || `venera:${slug(fileName || item?.key)}`, 180)
      if (!id.startsWith('venera:') || !scriptUrl || !fileName) return []
      return [{ id, key: clean(item?.key || slug(fileName), 120), name: clean(item?.name || item?.key || fileName, 160), version: clean(item?.version || '0.0.0', 40), description: clean(item?.description, 500), file_name: fileName, script_url: scriptUrl, repository_url: url, enabled: item?.enabled !== false } as VeneraSourceRecord]
    })
    return [{ url, name: clean(repository?.name || 'Venera 官方源仓库', 120), updated_at: clean(repository?.updated_at, 60), sources }]
  })
  return { version: 1, repositories }
}
export function getVeneraRepositoryConfig(): VeneraRepositoryConfig {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(SETTING_KEY) as any
  if (!row?.value) return { version: 1, repositories: [] }
  try { return normalizeConfig(JSON.parse(row.value)) } catch { return { version: 1, repositories: [] } }
}
function saveConfig(config: VeneraRepositoryConfig) {
  const normalized = normalizeConfig(config)
  db.prepare("INSERT OR REPLACE INTO settings (key,value,type,description) VALUES (?,?,'json','Venera JavaScript 漫画源仓库')").run(SETTING_KEY, JSON.stringify(normalized))
  runtimeCache.clear()
  return normalized
}
async function fetchLimited(url: string, maxBytes: number, timeout = 20000) {
  const response = await fetch(url, { headers: { Accept: 'application/json,text/javascript,text/plain,*/*', 'User-Agent': 'new-blog-venera/1.0' }, signal: AbortSignal.timeout(timeout) })
  if (!response.ok) throw new Error(`Venera 源仓库 HTTP ${response.status}`)
  const declared = Number(response.headers.get('content-length') || 0)
  if (declared > maxBytes) throw new Error('Venera 源文件超过大小限制')
  const text = await response.text()
  if (Buffer.byteLength(text) > maxBytes) throw new Error('Venera 源文件超过大小限制')
  return text
}
export async function importVeneraRepository(input: unknown) {
  const url = allowedRepositoryUrl(input)
  if (!url) throw new Error('目前仅允许导入 venera-app/venera-configs 的 jsDelivr 或 GitHub Raw 索引')
  const text = await fetchLimited(url, 1024 * 1024)
  let list: any[]
  try { list = JSON.parse(text) } catch { throw new Error('Venera 源仓库返回的不是有效 JSON') }
  if (!Array.isArray(list)) throw new Error('Venera 源仓库根节点必须是数组')
  const seen = new Set<string>()
  const sources = list.slice(0, 100).flatMap((item: any): VeneraSourceRecord[] => {
    const fileName = clean(item?.fileName || item?.filename, 180)
    const direct = clean(item?.url, 2000)
    let scriptUrl = ''
    try { scriptUrl = allowedScriptUrl(direct || new URL(fileName, url).toString()) } catch {}
    const baseId = slug(fileName || item?.key)
    if (!fileName || !scriptUrl || !baseId || seen.has(baseId)) return []
    seen.add(baseId)
    return [{ id: `venera:${baseId}`, key: clean(item?.key || baseId, 120), name: clean(item?.name || item?.key || baseId, 160), version: clean(item?.version || '0.0.0', 40), description: clean(item?.description, 500), file_name: fileName, script_url: scriptUrl, repository_url: url, enabled: true }]
  })
  if (!sources.length) throw new Error('仓库没有可用的 Venera JavaScript 漫画源')
  const current = getVeneraRepositoryConfig()
  const repository: VeneraRepository = { url, name: 'Venera 官方源仓库', updated_at: new Date().toISOString(), sources }
  const repositories = current.repositories.some((item) => item.url === url) ? current.repositories.map((item) => item.url === url ? repository : item) : [...current.repositories, repository]
  return saveConfig({ version: 1, repositories })
}
export function removeVeneraRepository(input: unknown) {
  const url = allowedRepositoryUrl(input)
  const current = getVeneraRepositoryConfig()
  return saveConfig({ version: 1, repositories: current.repositories.filter((item) => item.url !== url) })
}
export function getVeneraSources() { return getVeneraRepositoryConfig().repositories.flatMap((repository) => repository.sources).filter((source) => source.enabled) }
export function getVeneraSource(id: unknown) {
  const source = getVeneraSources().find((item) => item.id === clean(id, 180))
  if (!source) throw new Error(`Venera 漫画源 ${clean(id, 180) || '(未选择)'} 不存在`)
  return source
}

function buffer(value: any) {
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value))
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  if (typeof value === 'string') return Buffer.from(value)
  return Buffer.from(value || [])
}
function arrayBuffer(value: Buffer) { return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) }
function convertApi() {
  const digest = (name: string, value: any) => arrayBuffer(crypto.createHash(name).update(buffer(value)).digest())
  const decrypt = (mode: 'ecb' | 'cbc', value: any, keyValue: any, ivValue?: any) => {
    const key = buffer(keyValue), bits = key.length * 8
    const decipher = crypto.createDecipheriv(`aes-${bits}-${mode}`, key, mode === 'ecb' ? null : buffer(ivValue))
    return arrayBuffer(Buffer.concat([decipher.update(buffer(value)), decipher.final()]))
  }
  return {
    encodeUtf8: (value: unknown) => arrayBuffer(Buffer.from(String(value ?? ''), 'utf8')),
    decodeUtf8: (value: any) => buffer(value).toString('utf8'),
    encodeBase64: (value: any) => buffer(value).toString('base64'),
    decodeBase64: (value: unknown) => arrayBuffer(Buffer.from(String(value ?? ''), 'base64')),
    md5: (value: any) => digest('md5', value), sha1: (value: any) => digest('sha1', value), sha256: (value: any) => digest('sha256', value), sha512: (value: any) => digest('sha512', value),
    hmac: (key: any, value: any, hash = 'sha256') => arrayBuffer(crypto.createHmac(hash, buffer(key)).update(buffer(value)).digest()),
    hmacString: (key: any, value: any, hash = 'sha256') => crypto.createHmac(hash, buffer(key)).update(buffer(value)).digest('hex'),
    decryptAesEcb: (value: any, key: any) => decrypt('ecb', value, key), decryptAesCbc: (value: any, key: any, iv: any) => decrypt('cbc', value, key, iv),
    hexEncode: (value: any) => buffer(value).toString('hex'),
  }
}

class HtmlElementAdapter {
  constructor(private api: any, private node: any) {}
  get text() { return this.api(this.node).text() }
  get attributes() { return { ...(this.node?.attribs || {}) } }
  querySelector(query: string) { const node = this.api(this.node).find(query).first().get(0); return node ? new HtmlElementAdapter(this.api, node) : null }
  querySelectorAll(query: string) { return this.api(this.node).find(query).toArray().map((node: any) => new HtmlElementAdapter(this.api, node)) }
  get children() { return this.api(this.node).children().toArray().map((node: any) => new HtmlElementAdapter(this.api, node)) }
  get nodes() { return this.api(this.node).contents().toArray().map((node: any) => ({ text: node.type === 'text' ? node.data || '' : this.api(node).text(), type: node.type })) }
  get innerHTML() { return this.api(this.node).html() || '' }
  get innerHtml() { return this.innerHTML }
  get parent(): HtmlElementAdapter | null { const node = this.api(this.node).parent().get(0); return node ? new HtmlElementAdapter(this.api, node) : null }
  get classNames() { return clean(this.node?.attribs?.class, 1000).split(/\s+/).filter(Boolean) }
  get id() { return this.node?.attribs?.id || null }
  get localName() { return this.node?.name || '' }
  get previousElementSibling(): HtmlElementAdapter | null { const node = this.api(this.node).prev().get(0); return node ? new HtmlElementAdapter(this.api, node) : null }
  get nextElementSibling(): HtmlElementAdapter | null { const node = this.api(this.node).next().get(0); return node ? new HtmlElementAdapter(this.api, node) : null }
}
class HtmlDocumentAdapter {
  private api: any
  constructor(html: unknown) { this.api = load(String(html ?? '')) }
  querySelector(query: string) { const node = this.api(query).first().get(0); return node ? new HtmlElementAdapter(this.api, node) : null }
  querySelectorAll(query: string) { return this.api(query).toArray().map((node: any) => new HtmlElementAdapter(this.api, node)) }
  getElementById(id: string) { return this.querySelector(`#${id.replace(/[^a-z0-9_-]/gi, '')}`) }
  dispose() {}
}

function remoteUrl(value: unknown) {
  const raw = clean(value, 3000)
  let url: URL
  try { url = new URL(raw) } catch { throw new Error('Venera 源请求地址无效') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Venera 源只允许 HTTP/HTTPS 请求')
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1' || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) throw new Error('Venera 源禁止访问本机或内网地址')
  return url.toString()
}
function headersObject(headers: Headers) { return Object.fromEntries(headers.entries()) }
function createNetwork(record: VeneraSourceRecord) {
  const cookieJar = sourceCookies.get(record.id) || new Map()
  sourceCookies.set(record.id, cookieJar)
  async function request(method: string, urlValue: unknown, headersValue?: any, data?: any, bytes = false) {
    const url = remoteUrl(urlValue), target = new URL(url), headers = new Headers(headersValue || {})
    const cookies = cookieJar.get(target.origin) || []
    if (cookies.length && !headers.has('cookie')) headers.set('cookie', cookies.map((item: { name: string; value: string }) => `${item.name}=${item.value}`).join('; '))
    const response = await fetch(url, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : data == null ? undefined : typeof data === 'string' || ArrayBuffer.isView(data) || data instanceof ArrayBuffer ? data as any : JSON.stringify(data), redirect: 'follow', signal: AbortSignal.timeout(25000) })
    const bodyBuffer = Buffer.from(await response.arrayBuffer())
    if (bodyBuffer.length > 25 * 1024 * 1024) throw new Error('Venera 源响应超过 25MB 限制')
    return { status: response.status, headers: headersObject(response.headers), body: bytes ? arrayBuffer(bodyBuffer) : bodyBuffer.toString('utf8') }
  }
  return {
    sendRequest: (method: string, url: unknown, headers?: any, data?: any) => request(method, url, headers, data),
    fetchBytes: (method: string, url: unknown, headers?: any, data?: any) => request(method, url, headers, data, true),
    get: (url: unknown, headers?: any) => request('GET', url, headers), post: (url: unknown, headers?: any, data?: any) => request('POST', url, headers, data), put: (url: unknown, headers?: any, data?: any) => request('PUT', url, headers, data), patch: (url: unknown, headers?: any, data?: any) => request('PATCH', url, headers, data), delete: (url: unknown, headers?: any) => request('DELETE', url, headers),
    setCookies: (urlValue: unknown, cookies: any[]) => { const origin = new URL(remoteUrl(urlValue)).origin; cookieJar.set(origin, Array.isArray(cookies) ? cookies.map((item) => ({ name: clean(item?.name, 100), value: clean(item?.value, 1000), domain: clean(item?.domain, 200) })) : []) },
    getCookies: (urlValue: unknown) => cookieJar.get(new URL(remoteUrl(urlValue)).origin) || [],
    deleteCookies: (urlValue: unknown) => cookieJar.delete(new URL(remoteUrl(urlValue)).origin),
  }
}
function modelClass() { return class { constructor(value: any) { if (value && typeof value === 'object') Object.assign(this, value) } } }
async function loadRuntime(record: VeneraSourceRecord): Promise<Runtime> {
  const cached = runtimeCache.get(record.id)
  if (cached) return cached
  const code = await fetchLimited(record.script_url, 2 * 1024 * 1024)
  const className = code.match(/class\s+([A-Za-z_$][\w$]*)\s+extends\s+ComicSource\b/)?.[1]
  if (!className) throw new Error(`${record.name} 没有找到 ComicSource 子类`)
  const data = sourceData.get(record.id) || new Map<string, unknown>()
  sourceData.set(record.id, data)
  class ComicSourceBase {
    loadData(key: string) { return data.get(String(key)) }
    saveData(key: string, value: unknown) { data.set(String(key), value); return value }
    deleteData(key: string) { data.delete(String(key)) }
    loadSetting(key: string) { const own = (this as any).settings?.[key]; return own && typeof own === 'object' && 'default' in own ? own.default : undefined }
  }
  const Network = createNetwork(record), Convert = convertApi()
  const contextObject: any = Object.create(null)
  Object.assign(contextObject, {
    ComicSource: ComicSourceBase, Comic: modelClass(), ComicDetails: modelClass(), Comment: modelClass(), Cookie: modelClass(), HtmlDocument: HtmlDocumentAdapter,
    Network, Convert, APP: { locale: 'zh_CN', version: '1.6.0' }, Image: { empty: '' }, URL, URLSearchParams, TextEncoder, TextDecoder, AbortController,
    console: { log() {}, info() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async (url: unknown, options: any = {}) => { const result = await Network.fetchBytes(options.method || 'GET', url, options.headers || {}, options.body); const body = buffer(result.body); return { ok: result.status >= 200 && result.status < 300, status: result.status, statusText: '', headers: result.headers, arrayBuffer: async () => arrayBuffer(body), text: async () => body.toString('utf8'), json: async () => JSON.parse(body.toString('utf8')) } },
  })
  const context = vm.createContext(contextObject, { name: record.id, codeGeneration: { strings: false, wasm: false } })
  new vm.Script(`${code}\n;globalThis.__venera_source__ = new ${className}();`, { filename: record.file_name }).runInContext(context, { timeout: 2000 })
  const source = (context as any).__venera_source__
  if (!source?.search?.load || !source?.comic?.loadInfo || !source?.comic?.loadEp) throw new Error(`${record.name} 缺少搜索、详情或章节读取能力`)
  const runtime = { source, context, record }
  runtimeCache.set(record.id, runtime)
  if (typeof source.init === 'function') await invoke(runtime, '__venera_source__.init()', [], 10000).catch(() => undefined)
  return runtime
}
async function invoke(runtime: Runtime, expression: string, args: unknown[], timeout = 30000) {
  ;(runtime.context as any).__venera_args__ = args
  const promise = new vm.Script(expression).runInContext(runtime.context, { timeout: 3000 })
  try { return await Promise.race([Promise.resolve(promise), new Promise((_, reject) => setTimeout(() => reject(new Error(`${runtime.record.name} 执行超时`)), timeout))]) } finally { delete (runtime.context as any).__venera_args__ }
}
function sourceOptions(source: any) {
  const list = Array.isArray(source?.search?.optionList) ? source.search.optionList : []
  return list.map((group: any) => clean(Array.isArray(group?.options) ? group.options[0] : '', 200).split('-')[0])
}
function normalizeComic(item: any, record: VeneraSourceRecord) {
  const id = clean(item?.id || item?.comicId, 300), title = clean(item?.title, 300)
  return { external_id: id, source: record.id, source_label: record.name, title, original_title: clean(item?.subtitle || item?.subTitle, 300), author: clean(item?.subtitle || item?.subTitle, 200), cover: clean(item?.cover, 2000), source_url: clean(item?.url, 2000), rating: Number(item?.stars || item?.rating || 0) || 0, publication: clean(item?.updateTime || item?.uploadTime, 120), description: clean(item?.description, 5000), type: 'manga', total: Number(item?.maxPage || 0) || 0 }
}
function comicList(value: any) {
  if (Array.isArray(value)) return value.flatMap((item) => Array.isArray(item?.comics) ? item.comics : Array.isArray(item) ? item : item?.id ? [item] : [])
  if (Array.isArray(value?.comics)) return value.comics
  if (Array.isArray(value?.data)) return comicList(value.data)
  return []
}
export function publicVeneraSource(record: VeneraSourceRecord) { return { id: record.id, label: record.name, kinds: ['manga'], read_mode: 'pages', has_explore: true, has_catalog: true, has_reader: true, engine: 'venera-js', version: record.version, description: record.description } }
export async function searchVeneraSource(id: unknown, query: string, page = 1) {
  const record = getVeneraSource(id), runtime = await loadRuntime(record), options = sourceOptions(runtime.source)
  const value = await invoke(runtime, '__venera_source__.search.load(__venera_args__[0], __venera_args__[1], __venera_args__[2])', [query, options, page])
  return { record, items: comicList(value).map((item: any) => normalizeComic(item, record)).filter((item: ReturnType<typeof normalizeComic>) => item.external_id && item.title) }
}
export async function exploreVeneraSource(id: unknown, page = 1) {
  const record = getVeneraSource(id), runtime = await loadRuntime(record), explore = Array.isArray(runtime.source.explore) ? runtime.source.explore[0] : null
  if (!explore) throw new Error(`${record.name} 没有探索页`)
  const expression = typeof explore.load === 'function' ? '__venera_source__.explore[0].load(__venera_args__[0])' : typeof explore.loadNext === 'function' ? '__venera_source__.explore[0].loadNext(null)' : ''
  if (!expression) throw new Error(`${record.name} 的探索页无法加载`)
  const value = await invoke(runtime, expression, [page])
  return { record, items: comicList(value).map((item: any) => normalizeComic(item, record)).filter((item: ReturnType<typeof normalizeComic>) => item.external_id && item.title) }
}
function normalizeChapters(value: any) {
  const output: Array<{ external_id: string; title: string; volume: string; number: number; source_url: string }> = []
  const append = (input: any, volume = '') => {
    if (Array.isArray(input)) input.forEach((item, index) => output.push({ external_id: clean(item?.id ?? item?.key ?? index, 300), title: clean(item?.title || item?.name || item?.value, 300), volume, number: index + 1, source_url: '' }))
    else if (input && typeof input.entries === 'function') Array.from(input.entries() as Iterable<[unknown, unknown]>).forEach(([key, item], index) => {
      if (item && typeof (item as any).entries === 'function') append(item, clean(key, 300))
      else output.push({ external_id: clean(key, 300), title: clean(item, 300), volume, number: index + 1, source_url: '' })
    })
    else if (input && typeof input === 'object') Object.entries(input).forEach(([key, item], index) => { if (key === 'latestChapterMarker') return; if (item && typeof item === 'object' && !Array.isArray(item)) append(item, key); else output.push({ external_id: clean(key, 300), title: clean(item, 300), volume, number: index + 1, source_url: '' }) })
  }
  append(value)
  return output.filter((item) => item.external_id && item.title)
}
export async function detailVeneraSource(id: unknown, comicId: string) {
  const record = getVeneraSource(id), runtime = await loadRuntime(record)
  const info: any = await invoke(runtime, '__venera_source__.comic.loadInfo(__venera_args__[0])', [comicId])
  const item = normalizeComic({ ...info, id: info?.comicId || comicId }, record)
  return { record, item, chapters: normalizeChapters(info?.chapters), info }
}
export async function readVeneraSource(id: unknown, comicId: string, chapterId: string) {
  const record = getVeneraSource(id), runtime = await loadRuntime(record)
  const result: any = await invoke(runtime, '__venera_source__.comic.loadEp(__venera_args__[0], __venera_args__[1])', [comicId, chapterId])
  const pages = (Array.isArray(result?.images) ? result.images : Array.isArray(result?.pages) ? result.pages : []).map((item: any) => clean(typeof item === 'string' ? item : item?.url, 3000)).filter(Boolean)
  return { record, reader: { title: clean(result?.title, 300), content: '', content_html: '', pages, source_url: clean(result?.url, 2000) } }
}
export async function fetchVeneraImage(id: unknown, targetValue: unknown) {
  const record = getVeneraSource(id), runtime = await loadRuntime(record)
  let url = remoteUrl(targetValue), headers: Record<string, string> = {}
  const handler = runtime.source?.comic?.onImageLoad || runtime.source?.comic?.onThumbnailLoad
  if (typeof handler === 'function') {
    const method = runtime.source.comic.onImageLoad === handler ? 'onImageLoad' : 'onThumbnailLoad'
    const config: any = await invoke(runtime, `__venera_source__.comic.${method}(__venera_args__[0], '', '')`, [url]).catch(() => null)
    if (config?.url) url = remoteUrl(config.url)
    if (config?.headers && typeof config.headers === 'object') headers = Object.fromEntries(Object.entries(config.headers).slice(0, 20).map(([key, value]) => [clean(key, 100), clean(value, 1000)]).filter(([key]) => key))
  }
  return fetch(url, { headers, signal: AbortSignal.timeout(25000) })
}
