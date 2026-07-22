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

export function renderMarkdown(content = ''): string {
  return sanitizeHtml(md.render(String(content || '')))
    .replace(/<img /g, '<img loading="lazy" ')
    .replace(/<iframe /g, '<iframe loading="lazy" ')
}
