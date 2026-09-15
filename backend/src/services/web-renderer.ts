import { chromium } from 'playwright'
import { fetchWeb, webUrl } from './web-fetch'
import { articleSelectors, articleSite, canonicalArticleUrl, verificationResponse, WebArticleError } from './web-article'

let running = false

/** All requests use DNS-pinned fetchWeb, including scripts, XHR and redirects.
 * Ephemeral contexts never use admin cookies or personal browser profiles.
 */
export async function renderWebArticle(value: string): Promise<{html: string; url: string}> {
  const url = canonicalArticleUrl(value)
  if (running) throw new WebArticleError('浏览器正在提取其他文章，请稍后重试', 'BUSY')
  running = true
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  let timer: NodeJS.Timeout | undefined
  let timedOut = false, challenge = false, requests = 0, bytes = 0
  const controller = new AbortController()
  try {
    try {
      browser = await chromium.launch({
        headless: true,
        timeout: 15_000,
        executablePath: process.env.WEB_IMPORT_CHROMIUM || undefined,
        channel: process.env.WEB_IMPORT_BROWSER_CHANNEL || undefined,
        chromiumSandbox: process.platform === 'linux' && process.getuid?.() !== 0,
        args: ['--disable-quic', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
      })
    } catch { throw new WebArticleError('动态网页引擎未就绪，请运行部署脚本安装 Chromium 后重试', 'BROWSER_UNAVAILABLE') }
    const activeBrowser = browser
    timer = setTimeout(() => { timedOut = true; controller.abort(); void activeBrowser.close().catch(() => {}) }, 45_000)
    const context = await browser.newContext({serviceWorkers: 'block', acceptDownloads: false, locale: 'zh-CN'})
    await context.routeWebSocket('**/*', socket => socket.close())
    await context.route('**/*', async route => {
      const request = route.request()
      if (timedOut || ++requests > 160 || bytes > 40 * 1024 * 1024 ||
          !['GET', 'HEAD'].includes(request.method()) || ['image','media','font'].includes(request.resourceType())) {
        await route.abort().catch(() => {}); return
      }
      try {
        webUrl(request.url())
        const incoming = await request.allHeaders()
        const headers: Record<string,string> = {}
        for (const key of ['user-agent','accept','accept-language','referer','origin','cookie']) if (incoming[key]) headers[key] = incoming[key]
        const response = await fetchWeb(request.url(), 8 * 1024 * 1024, 0, {
          headers, manualRedirect: true, allowHttpErrors: true, signal: controller.signal,
          onBytes: size => { bytes += size; if (bytes > 40 * 1024 * 1024) throw new Error('动态页面下载量超过限制') },
        })
        if (new URL(request.url()).hostname === 'api.xiaoheihe.cn' && verificationResponse(response.bytes.toString('utf8'))) challenge = true
        const outputHeaders: Record<string,string> = {}
        for (const [key, entry] of Object.entries(response.headers || {})) {
          if (!/^(content-type|location|access-control-.*|content-security-policy|set-cookie)$/i.test(key) || entry === undefined) continue
          outputHeaders[key] = Array.isArray(entry) ? entry.join('\n') : entry
        }
        await route.fulfill({status: response.status || 200, headers: outputHeaders, body: response.bytes})
      } catch { await route.abort().catch(() => {}) }
    })
    const page = await context.newPage()
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 30_000})
    const site = articleSite(page.url())
    const selector = site ? articleSelectors[site] : 'article, main, [role="main"]'
    let ready = false
    for (let attempt = 0; attempt < 30; attempt++) {
      if (challenge) throw new WebArticleError('小黑盒要求人工验证。请在你能正常阅读的页面复制文章图文，切换到“粘贴图文”导入；无需提供账号或 Cookie。', 'VERIFICATION_REQUIRED')
      ready = await page.locator(selector).evaluateAll(nodes => nodes.some(node => (node.textContent || '').trim().length >= 80))
      if (ready) break
      await page.waitForTimeout(500)
    }
    if (!ready && site) throw new WebArticleError('网页未返回可用的文章正文。可在正常打开文章后，使用“粘贴图文”导入。', 'DYNAMIC_EMPTY')
    const expand = page.getByText(/^(展开全文|展开正文|阅读全文)$/).first()
    if (await expand.isVisible().catch(() => false)) {
      await expand.click({timeout: 2000}).catch(() => {})
      await page.waitForTimeout(500)
      if (await expand.isVisible().catch(() => false)) throw new WebArticleError('文章正文未完全展开，请在原网页展开后使用“粘贴图文”导入', 'DYNAMIC_EMPTY')
    }
    for (let step = 0; step < 5; step++) {
      await page.evaluate('window.scrollBy(0, Math.max(window.innerHeight, document.body.scrollHeight / 5))')
      await page.waitForTimeout(150)
    }
    let previousLength = -1
    for (let attempt = 0; attempt < 4; attempt++) {
      const length = await page.locator(selector).evaluateAll(nodes => nodes.reduce((sum, node) => sum + (node.textContent || '').length, 0))
      if (length === previousLength) break
      previousLength = length
      await page.waitForTimeout(500)
    }
    const html = await page.content()
    if (Buffer.byteLength(html) > 6 * 1024 * 1024) throw new WebArticleError('文章页面超过大小限制')
    return {html, url: canonicalArticleUrl(page.url())}
  } catch (cause) {
    if (timedOut) throw new WebArticleError('动态文章加载超时，请重试或使用“粘贴图文”导入', 'RENDER_TIMEOUT')
    throw cause
  } finally {
    if (timer) clearTimeout(timer)
    controller.abort()
    await browser?.close().catch(() => {})
    running = false
  }
}
