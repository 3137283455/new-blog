import * as cheerio from 'cheerio'
import { webUrl } from './web-fetch'

export class WebArticleError extends Error {
  constructor(message: string, public code = 'EXTRACTION_FAILED') { super(message) }
}

export function articleSite(value: string): 'bilibili' | 'heybox' | undefined {
  const host = webUrl(value).hostname
  if (host === 'b23.tv' || host === 'bilibili.com' || host.endsWith('.bilibili.com')) return 'bilibili'
  if (host === 'xiaoheihe.cn' || host.endsWith('.xiaoheihe.cn')) return 'heybox'
}

export function canonicalArticleUrl(value: string): string {
  const url = webUrl(value)
  if (articleSite(value) === 'bilibili' && /^\/opus\/\d+\/?$/.test(url.pathname)) {
    url.hostname = 'www.bilibili.com'; url.search = ''
  }
  return url.href
}

export const articleSelectors = {
  bilibili: '.opus-module-content, .article-holder',
  heybox: '.hb-bbs-link-content, .bbs-link-content, .article-content, .link-content, .hb-rich-text, .rich-text-content',
}

// Known-site scoping prevents navigation/recommendations being accepted as an article.
export function prepareArticleHtml(html: string, url: string, assisted = false): {html: string; scoped: boolean} {
  const $ = cheerio.load(html)
  $('script, style, iframe, form, button, input, noscript, template').remove()
  const site = articleSite(url)
  const selector = site && articleSelectors[site]
  let root = selector ? $(selector).filter((_, node) => $(node).text().trim().length >= 80).first() : undefined
  if (assisted && !root?.length) {
    // The user explicitly selected this fragment. Keep its images and short
    // paragraphs rather than asking a text heuristic to choose them again.
    $('nav, aside, footer, [role="navigation"]').remove()
    root = $('article, main').filter((_, node) => $(node).text().trim().length >= 80).first()
    if (!root.length) root = $('body')
  }
  if (site && !root?.length && !assisted) throw new WebArticleError('文章正文尚未加载', 'DYNAMIC_REQUIRED')
  const title = (site === 'bilibili' ? $('.opus-module-title, .title-container .title').first().text() : '') || $('meta[property="og:title"]').attr('content') || $('title').text() || $('h1').first().text()
  const author = $('meta[name="author"]').attr('content') || (site === 'bilibili' ? $('.opus-module-author__name').first().text() : '')
  const body = root?.length ? root : $('body')
  body.find('img').each((_, node) => {
    const img = $(node)
    const src = img.attr('data-original') || img.attr('data-src') || img.attr('src')
    if (!src || /^(data:|blob:)/i.test(src)) { img.remove(); return }
    try { img.attr('src', webUrl(new URL(src, url).href).href) } catch { img.remove() }
  })
  if (root?.length) {
    const doc = cheerio.load('<html><head></head><body><article></article></body></html>')
    doc('head').append(doc('<title>').text(title.replace(/\s*-\s*哔哩哔哩$/, '')))
    if (author) doc('head').append(doc('<meta>').attr({name: 'author', content: author}))
    $('meta[property="article:published_time"], meta[name="date"], meta[name="publishdate"]').each((_, node) => { doc('head').append($.html(node)) })
    doc('article').html(body.html() || '')
    return {html: doc.html(), scoped: true}
  }
  return {html: $.html(), scoped: false}
}

export function verificationResponse(value: string): boolean {
  try { return JSON.parse(value)?.status === 'show_captcha' } catch { return false }
}
