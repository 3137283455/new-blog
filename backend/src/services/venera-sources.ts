import crypto from 'crypto'
import vm from 'vm'
import { load } from 'cheerio'
import db from '../config/database'
import { invokeSource } from '../modules/manga/runtime/invocation'
import { loadExactChapter } from '../modules/manga/runtime/chapter'
import { loadSourceImage, type ImageContext } from '../modules/manga/images/pipeline'
import { PersistentSourceMap } from '../modules/manga/storage/source-store'
import { sourceStore } from '../modules/manga/storage/database-store'

import { getVeneraSource, clean, fetchLimited, sourceConfigurationRevision, type VeneraSourceRecord } from '../modules/manga/repositories'
export * from '../modules/manga/repositories'

type Runtime = { source: any; context: vm.Context; record: VeneraSourceRecord }

const runtimeCache = new Map<string, Runtime>()
const runtimeLoads = new Map<string, Promise<Runtime>>()
let runtimeGeneration = 0
let observedConfigurationRevision = -1
const sourceData = new Map<string, Map<string, unknown>>()
const sourceCookies = new Map<string, PersistentSourceMap>()

export async function getVeneraSourceSettings(id: unknown) {
  const record = getVeneraSource(id), runtime = await loadRuntime(record)
  const saved = sourceStore.readArea(record.id, 'settings')
  return Object.entries(runtime.source.settings || {}).map(([key, definition]: [string, any]) => ({
    key, title: clean(definition?.title || key, 300), type: clean(definition?.type, 50), options: definition?.options || [],
    value: saved.has(key) ? saved.get(key) : definition?.default,
  }))
}
export async function saveVeneraSourceSettings(id: unknown, values: unknown) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('设置必须为对象')
  const record = getVeneraSource(id), runtime = await loadRuntime(record)
  const entries = Object.entries(values)
  if (entries.some(([key]) => !Object.hasOwn(runtime.source.settings || {}, key))) throw new Error('包含此源未定义的设置')
  db.transaction(() => entries.forEach(([key, value]) => sourceStore.write(record.id, 'settings', key, value)))()
  runtimeCache.delete(record.id)
  runtimeLoads.delete(record.id)
  runtimeGeneration++
}
function buffer(value: any) {
  // Values returned by a source live in a VM context, so `instanceof
  // ArrayBuffer` is not reliable across realms.  Detect transferable binary
  // values by their shape as well; otherwise image request bodies and
  // onResponse results can be silently coerced into an invalid buffer.
  if (value instanceof ArrayBuffer || Object.prototype.toString.call(value) === '[object ArrayBuffer]') return Buffer.from(new Uint8Array(value))
  if (ArrayBuffer.isView(value) || value?.buffer && typeof value.byteLength === 'number') return Buffer.from(value.buffer, value.byteOffset || 0, value.byteLength)
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
  const cookieJar = sourceCookies.get(record.id) || new PersistentSourceMap(sourceStore, record.id, 'cookies')
  sourceCookies.set(record.id, cookieJar)
  async function request(method: string, urlValue: unknown, headersValue?: any, data?: any, bytes = false) {
    const url = remoteUrl(urlValue), target = new URL(url), headers = new Headers(headersValue || {})
    const cookies = (cookieJar.get(target.origin) || []) as Array<{name: string; value: string}>
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
  if (observedConfigurationRevision !== sourceConfigurationRevision) {
    runtimeCache.clear()
    runtimeLoads.clear()
    runtimeGeneration++
    observedConfigurationRevision = sourceConfigurationRevision
  }
  const cached = runtimeCache.get(record.id)
  if (cached) return cached
  const pending = runtimeLoads.get(record.id)
  if (pending) return pending
  const generation = runtimeGeneration
  const loading = buildRuntime(record).then(runtime => {
    if (generation === runtimeGeneration) runtimeCache.set(record.id, runtime)
    return runtime
  }).finally(() => {
    if (runtimeLoads.get(record.id) === loading) runtimeLoads.delete(record.id)
  })
  runtimeLoads.set(record.id, loading)
  return loading
}
async function buildRuntime(record: VeneraSourceRecord): Promise<Runtime> {
  const configurationRevision = sourceConfigurationRevision
  const cachedScript = sourceStore.readScript(record)
  const code = cachedScript ?? await fetchLimited(record.script_url, 2 * 1024 * 1024)
  const className = code.match(/class\s+([A-Za-z_$][\w$]*)\s+extends\s+ComicSource\b/)?.[1]
  if (!className) throw new Error(`${record.name} 没有找到 ComicSource 子类`)
  const data = sourceData.get(record.id) || new PersistentSourceMap(sourceStore, record.id, 'data')
  const settingValues = new PersistentSourceMap(sourceStore, record.id, 'settings')
  sourceData.set(record.id, data)
  class ComicSourceBase {
    loadData(key: string) { return data.get(String(key)) }
    saveData(key: string, value: unknown) { data.set(String(key), value); return value }
    deleteData(key: string) { data.delete(String(key)) }
    loadSetting(key: string) {
      if (settingValues.has(key)) return settingValues.get(key)
      const own = (this as any).settings?.[key]
      const value = own && typeof own === 'object' && 'default' in own ? own.default : undefined
      return value
    }
    get isLogged() { return false }
    translate(key: string) { const translations = (this as any).translation; return translations?.zh_CN?.[key] ?? translations?.zh_CN?.[String(key)] ?? key }
  }
  const Network = createNetwork(record), Convert = convertApi()
  const contextObject: any = Object.create(null)
  let clipboard = ''
  Object.assign(contextObject, {
    ComicSource: ComicSourceBase, Comic: modelClass(), ComicDetails: modelClass(), Comment: modelClass(), Cookie: modelClass(), ImageLoadingConfig: modelClass(), HtmlDocument: HtmlDocumentAdapter,
    Network, Convert, APP: { locale: 'zh_CN', version: '1.6.0', platform: process.platform === 'win32' ? 'windows' : process.platform }, Image: { empty: '' }, URL, URLSearchParams, TextEncoder, TextDecoder, AbortController,
    console: { log() {}, info() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval, clearInterval,
    log() {},
    createUuid: () => crypto.randomUUID(),
    randomInt: (minValue: unknown, maxValue: unknown) => { const min = Math.ceil(Number(minValue) || 0), max = Math.floor(Number(maxValue) || 0); return max <= min ? min : crypto.randomInt(min, max + 1) },
    randomDouble: (minValue: unknown, maxValue: unknown) => { const min = Number(minValue) || 0, max = Number(maxValue) || 0; return min + Math.random() * (max - min) },
    atob: (value: unknown) => Buffer.from(String(value ?? ''), 'base64').toString('binary'),
    btoa: (value: unknown) => Buffer.from(String(value ?? ''), 'binary').toString('base64'),
    setClipboard: async (value: unknown) => { clipboard = String(value ?? '') },
    getClipboard: async () => clipboard,
    UI: { showMessage() {}, launchUrl() {}, showDialog: async () => undefined, showLoading: () => 0, cancelLoading() {}, showInputDialog: async () => null, showSelectDialog: async () => null },
    fetch: async (url: unknown, options: any = {}) => { const result = await Network.fetchBytes(options.method || 'GET', url, options.headers || {}, options.body); const body = buffer(result.body); return { ok: result.status >= 200 && result.status < 300, status: result.status, statusText: '', headers: result.headers, arrayBuffer: async () => arrayBuffer(body), text: async () => body.toString('utf8'), json: async () => JSON.parse(body.toString('utf8')) } },
  })
  const context = vm.createContext(contextObject, { name: record.id, codeGeneration: { strings: false, wasm: false } })
  contextObject.compute = async (source: unknown, ...args: unknown[]) => {
    return invokeSource(context, `(${String(source)})(...__venera_compute_args__)`, args, record.name, 30000, '__venera_compute_args__')
  }
  new vm.Script(`${code}\n;globalThis.__venera_source__ = new ${className}();`, { filename: record.file_name }).runInContext(context, { timeout: 2000 })
  const source = (context as any).__venera_source__
  if (!source?.search?.load || !source?.comic?.loadInfo || !source?.comic?.loadEp) throw new Error(`${record.name} 缺少搜索、详情或章节读取能力`)
  const runtime = { source, context, record }
  if (typeof source.init === 'function') await invoke(runtime, '__venera_source__.init()', [], 10000)
  if (cachedScript === undefined && configurationRevision === sourceConfigurationRevision) sourceStore.writeScript(record, code)
  return runtime
}
async function invoke(runtime: Runtime, expression: string, args: unknown[], timeout = 30000) {
  return invokeSource(runtime.context, expression, args, runtime.record.name, timeout)
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
  const reader = await loadExactChapter(comicId, chapterId, (work, chapter) =>
    invoke(runtime, '__venera_source__.comic.loadEp(__venera_args__[0], __venera_args__[1])', [work, chapter]))
  return { record, reader }
}

export async function fetchVeneraImage(id: unknown, targetValue: unknown, context: ImageContext = {}) {
  const record = getVeneraSource(id), runtime = await loadRuntime(record)
  const result = await loadSourceImage(targetValue, context, {
    comic: runtime.source.comic, validateUrl: remoteUrl,
    invoke: (callback, args, receiver) => invoke(runtime, '__venera_args__[0].apply(__venera_args__[2], __venera_args__[1])', [callback, args, receiver]),
  })
  return new Response(new Uint8Array(result.bytes), { headers: { 'Content-Type': result.contentType, 'Cache-Control': 'private, no-store' } })
}
