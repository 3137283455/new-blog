import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

// Parse only: this DOM implementation does not execute scripts or load resources.
// The caller must still sanitize the returned HTML before previewing or saving it.
export function extractWithReadability(html: string, url: string) {
  const { document } = parseHTML(html)
  document.querySelectorAll('base').forEach(node => node.remove())
  Object.defineProperty(document, 'documentURI', { value: url, configurable: true })
  Object.defineProperty(document, 'baseURI', { value: url, configurable: true })
  const article = new Readability(document as unknown as Document, {
    maxElemsToParse: 50000,
    charThreshold: 100,
  }).parse()
  if (!article?.content || !article.textContent || article.textContent.trim().length < 80) {
    throw new Error('未找到可导入的正文；该网页可能需要登录、浏览器渲染，或不是文章详情页')
  }
  return {
    html: article.content,
    title: article.title || '',
    author: article.byline || '',
    date: article.publishedTime || '',
    description: article.excerpt || '',
    engine: 'readability',
  }
}
