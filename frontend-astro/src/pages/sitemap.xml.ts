import type { APIRoute } from 'astro'
import { getAlbums, getArticles, getPages, getSeries } from '@/lib/api'

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[character] || character)
}

export const GET: APIRoute = async ({ url }) => {
  type SitemapEntry = { path: string; lastmod?: string | null }
  const staticPaths = ['/', '/archive', '/nav', '/series', '/memories', '/bangumi', '/albums', '/music']
  const [pages, albums, series] = await Promise.all([getPages(), getAlbums(), getSeries()])
  const articles = []
  let page = 1
  let totalPages = 1

  do {
    const result = await getArticles({ page, pageSize: 100 })
    articles.push(...result.articles)
    totalPages = Math.min(Number(result.pagination?.totalPages || 1), 100)
    page += 1
  } while (page <= totalPages)

  const entries: SitemapEntry[] = [
    ...staticPaths.map((path) => ({ path })),
    ...pages.map((item) => ({ path: `/page/${item.slug}`, lastmod: item.updated_at || item.created_at })),
    ...albums.map((item) => ({ path: `/albums/${item.id}` })),
    ...series.map((item) => ({ path: `/series/${item.slug}` })),
    ...articles.map((item) => ({
      path: `/article/${item.slug}`,
      lastmod: item.updated_at || item.published_at || item.created_at,
    })),
  ]

  const urls = entries.map((entry) => {
    const location = escapeXml(new URL(entry.path, url.origin).href)
    const lastmod = entry.lastmod ? `<lastmod>${escapeXml(new Date(entry.lastmod).toISOString())}</lastmod>` : ''
    return `<url><loc>${location}</loc>${lastmod}</url>`
  }).join('')

  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
