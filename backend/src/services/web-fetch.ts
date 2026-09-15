import http from 'node:http'
import https from 'node:https'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import ipaddr from 'ipaddr.js'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'

type FetchOptions = { headers?: Record<string, string>; manualRedirect?: boolean; allowHttpErrors?: boolean; signal?: AbortSignal; onBytes?: (size: number) => void }

export function publicAddress(value: string): boolean {
  try {
    const address = ipaddr.process(value)
    return address.range() === 'unicast'
  } catch { return false }
}

export function webUrl(value: string): URL {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80', '443'].includes(url.port))) throw new Error('仅支持标准端口的 HTTP/HTTPS 网页链接')
  url.hash = ''
  return url
}

// Pin the validated DNS answer to the socket; validate again on every redirect.
export async function fetchWeb(value: string, limit = 3 * 1024 * 1024, hops = 0, options: FetchOptions = {}): Promise<{bytes: Buffer; type: string; url: string; status?: number; headers?: http.IncomingHttpHeaders}> {
  if (hops > 4) throw new Error('网页重定向次数过多')
  options.signal?.throwIfAborted()
  const url = webUrl(value)
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const records = isIP(host) ? [{address: host, family: isIP(host)}] : await Promise.race([
    lookup(host, {all: true}),
    new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error('域名解析超时')), 5000); timer.unref() }),
  ])
  if (!records.length || records.some(item => !publicAddress(item.address))) throw new Error('不允许访问本机、内网或保留地址')
  const record = records[0]
  options.signal?.throwIfAborted()
  const result = await new Promise<{bytes: Buffer; type: string; location?: string; status: number; headers: http.IncomingHttpHeaders}>((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http
    const request = transport.get(url, {
      agent: false,
      headers: {'User-Agent': 'Boke-WebImport/1.0', Accept: '*/*', ...options.headers, 'Accept-Encoding': 'identity'},
      lookup: ((_host: string, options: any, callback: any) => options?.all
        ? callback(null, [record]) : callback(null, record.address, record.family)) as any,
    }, response => {
      if ([301,302,303,307,308].includes(response.statusCode || 0) && response.headers.location) {
        response.resume(); resolve({bytes: Buffer.alloc(0), type: '', location: response.headers.location, status: response.statusCode!, headers: response.headers}); return
      }
      if ((response.statusCode || 500) >= 400 && !options.allowHttpErrors) { response.resume(); reject(new Error(`网页访问失败（HTTP ${response.statusCode}）`)); return }
      const encoding = response.headers['content-encoding']
      const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'br' ? createBrotliDecompress() : encoding === 'deflate' ? createInflate() : null
      if (encoding && encoding !== 'identity' && !decoder) { response.destroy(); reject(new Error('网页返回了不支持的压缩响应')); return }
      const stream = decoder ? response.pipe(decoder) : response
      let size = 0
      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > limit) { const cause = new Error('下载内容超过大小限制'); reject(cause); stream.destroy(); request.destroy(cause); return }
        try { options.onBytes?.(chunk.length) } catch (cause) { reject(cause); stream.destroy(); request.destroy(); return }
        chunks.push(chunk)
      })
      response.on('error', reject)
      response.on('aborted', () => reject(new Error('网页连接提前中断，请重试')))
      stream.on('error', reject)
      stream.on('end', () => resolve({bytes: Buffer.concat(chunks), type: String(response.headers['content-type'] || ''), status: response.statusCode || 200, headers: response.headers}))
    })
    const timer = setTimeout(() => request.destroy(new Error('下载超时，请重试')), 15000)
    const abort = () => request.destroy(new Error('网页提取已取消'))
    options.signal?.addEventListener('abort', abort, {once: true})
    if (options.signal?.aborted) abort()
    request.on('close', () => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort) })
    request.on('error', reject)
  })
  if (result.location && !options.manualRedirect) {
    const headers = options.headers ? {...options.headers} : undefined
    if (headers && new URL(result.location, url).origin !== url.origin) {
      for (const key of Object.keys(headers)) if (/^(cookie|authorization|origin|referer)$/i.test(key)) delete headers[key]
    }
    return fetchWeb(new URL(result.location, url).href, limit, hops + 1, {...options, headers})
  }
  return {...result, url: url.href}
}
