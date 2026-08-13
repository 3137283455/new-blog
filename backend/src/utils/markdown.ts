import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import mk from 'markdown-it-katex'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch {
        // Let markdown-it escape the code if highlighting fails.
      }
    }
    return ''
  },
})
  .use(mk, { throwOnError: false, strict: false })
  .use(footnote)
  .use(taskLists, { enabled: true, label: true })

const EPUB_MARKER = '<!-- boke:epub-novel -->'

function sanitizeHtml(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<object\b[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[\s\S]*?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+((?:xlink:)?href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"')
    .replace(/\s+((?:xlink:)?href|src)\s*=\s*javascript:[^\s>]+/gi, ' $1="#"')
}

function decorateMedia(html: string) {
  return html
    .replace(/<img(?![^>]*\bloading=) /gi, '<img loading="lazy" ')
    .replace(/<iframe(?![^>]*\bloading=) /gi, '<iframe loading="lazy" ')
}

export function renderMarkdown(content = ''): string {
  return decorateMedia(sanitizeHtml(md.render(String(content || ''))))
}

export function isEpubContent(content = ''): boolean {
  return String(content || '').includes(EPUB_MARKER)
}

export function needsEpubHtmlRepair(content = '', contentHtml = ''): boolean {
  if (!isEpubContent(content)) return false
  const rendered = String(contentHtml || '')
  return !rendered.includes('class="epub-chapter"')
    || /<pre><code[^>]*>[\s\S]{0,1200}&lt;(?:section|div|h[1-6]|p|svg|img)\b/i.test(rendered)
}

/**
 * EPUB imports already contain sanitized structural HTML. Sending that HTML
 * through markdown-it makes indented XHTML fragments become fenced-looking
 * code blocks, which exposes tags and removes the headings used by the TOC.
 */
export function renderArticleContent(content = ''): string {
  const source = String(content || '')
  if (!isEpubContent(source)) return renderMarkdown(source)
  const epubHtml = source.replace(/<!--\s*boke:epub-novel\s*-->/gi, '').trim()
  return decorateMedia(sanitizeHtml(epubHtml))
}
