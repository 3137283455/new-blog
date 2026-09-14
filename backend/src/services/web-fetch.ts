import http from 'node:http'
import https from 'node:https'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import ipaddr from 'ipaddr.js'

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
export async function fetchWeb(value: string, limit = 3 * 1024 * 1024, hops = 0): Promise<{bytes: Buffer; type: string; url: string}> {
  if (hops > 4) throw new Error('网页重定向次数过多')
  const url = webUrl(value)
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const records = isIP(host) ? [{address: host, family: isIP(host)}] : await Promise.race([
    lookup(host, {all: true}),
    new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error('域名解析超时')), 5000); timer.unref() }),
  ])
  if (!records.length || records.some(item => !publicAddress(item.address))) throw new Error('不允许访问本机、内网或保留地址')
  const record = records[0]
  const result = await new Promise<{bytes: Buffer; type: string; location?: string}>((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http
    const request = transport.get(url, {
      agent: false,
      headers: {'User-Agent': 'Boke-WebImport/1.0', 'Accept-Encoding': 'identity', Accept: '*/*'},
      lookup: ((_host: string, options: any, callback: any) => options?.all
        ? callback(null, [record]) : callback(null, record.address, record.family)) as any,
    }, response => {
      if ([301,302,303,307,308].includes(response.statusCode || 0) && response.headers.location) {
        response.resume(); resolve({bytes: Buffer.alloc(0), type: '', location: response.headers.location}); return
      }
      if ((response.statusCode || 500) >= 400) { response.resume(); reject(new Error(`网页访问失败（HTTP ${response.statusCode}）`)); return }
      if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
        response.destroy(); reject(new Error('网页返回了不支持的压缩响应')); return
      }
      let size = 0
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > limit) { request.destroy(new Error('下载内容超过大小限制')); return }
        chunks.push(chunk)
      })
      response.on('error', reject)
      response.on('end', () => resolve({bytes: Buffer.concat(chunks), type: String(response.headers['content-type'] || ''), location: undefined}))
    })
    const timer = setTimeout(() => request.destroy(new Error('下载超时，请重试')), 15000)
    request.on('close', () => clearTimeout(timer))
    request.on('error', reject)
  })
  if (result.location) return fetchWeb(new URL(result.location, url).href, limit, hops + 1)
  return {...result, url: url.href}
}
