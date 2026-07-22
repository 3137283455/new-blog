export type TocItem = {
  id: string
  text: string
  level: number
}

export type FontLike = {
  name?: string
  family?: string
  url?: string
}

export function cssString(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')
}

export function cssUrl(value = '') {
  return String(value).replace(/["\\\r\n]/g, '')
}

export function stripHtml(value = '') {
  return String(value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

export function restoreInlineFontSpans(value = '') {
  return String(value).replace(
    /&lt;span\s+data-font=(?:&quot;|&#39;)([^&]+?)(?:&quot;|&#39;)(?:\s+data-font-url=(?:&quot;|&#39;)([^&]*?)(?:&quot;|&#39;))?&gt;([\s\S]*?)&lt;\/span&gt;/g,
    (_match, family, url, inner) => {
      const safeFamily = String(family).replace(/"/g, '&quot;')
      const safeUrl = String(url || '').replace(/"/g, '&quot;')
      return `<span data-font="${safeFamily}"${safeUrl ? ` data-font-url="${safeUrl}"` : ''}>${inner}</span>`
    },
  )
}

function slugifyHeading(value: string, index: number) {
  const base = stripHtml(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return base || `heading-${index + 1}`
}

export function injectHeadingIds(html = '') {
  const toc: TocItem[] = []
  const usedIds = new Map<string, number>()
  const content = restoreInlineFontSpans(html).replace(/<h([2-3])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_match, level, attrs, inner) => {
    const existing = String(attrs).match(/\sid=["']([^"']+)["']/i)?.[1]
    let id = existing || slugifyHeading(inner, toc.length)
    const count = usedIds.get(id) || 0
    usedIds.set(id, count + 1)
    if (count) id = `${id}-${count + 1}`
    toc.push({ id, text: stripHtml(inner), level: Number(level) })
    const nextAttrs = existing ? attrs : `${attrs} id="${id}"`
    return `<h${level}${nextAttrs}>${inner}</h${level}>`
  })

  return { html: content, toc }
}

export function buildArticleFontCss(article: Record<string, any>, fontLibrary: FontLike[] = []) {
  const inlineFonts = Array.from(String(article.content_html || '').matchAll(/data-font=["']([^"']+)["'][^>]*data-font-url=["']([^"']+)["']/g))
    .map((match) => ({ family: match[1], url: match[2] }))
  return [
    article.title_font_family && article.title_font_url
      ? `@font-face{font-family:"${cssString(article.title_font_family)}";src:url("${cssUrl(article.title_font_url)}");font-display:swap;}`
      : '',
    article.body_font_family && article.body_font_url
      ? `@font-face{font-family:"${cssString(article.body_font_family)}";src:url("${cssUrl(article.body_font_url)}");font-display:swap;}`
      : '',
    ...fontLibrary.concat(inlineFonts).map((font) => {
      const family = font?.family || font?.name || ''
      const url = font?.url || ''
      return family && url
        ? `@font-face{font-family:"${cssString(family)}";src:url("${cssUrl(url)}");font-display:swap;}[data-font="${cssString(family)}"]{font-family:"${cssString(family)}",var(--font-body),sans-serif;}`
        : ''
    }),
  ].filter(Boolean).join('\n')
}

export function fontFamilyStyle(family?: string, fallback = 'var(--font-body)') {
  return family ? `font-family: "${cssString(family)}", ${fallback}, sans-serif;` : undefined
}
