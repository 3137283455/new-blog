import type { APIRoute } from 'astro'

export const GET: APIRoute = ({ url }) => {
  const content = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    `Sitemap: ${url.origin}/sitemap.xml`,
    '',
  ].join('\n')

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
