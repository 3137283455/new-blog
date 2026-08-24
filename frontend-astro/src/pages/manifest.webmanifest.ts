import type { APIRoute } from 'astro'

export const GET: APIRoute = () => new Response(JSON.stringify({
  name: 'My Blog · Notes & Stories',
  short_name: 'My Blog',
  description: '记录技术、生活与灵感的个人空间',
  start_url: '/nav',
  scope: '/',
  display: 'standalone',
  background_color: '#f4f2ea',
  theme_color: '#5e7c61',
  lang: 'zh-CN',
  icons: [
    { src: '/profile.webp', sizes: 'any', type: 'image/webp', purpose: 'any maskable' },
  ],
  shortcuts: [
    { name: '网址导航', short_name: '导航', url: '/nav' },
    { name: '搜索文章', short_name: '搜索', url: '/search' },
    { name: '开始写作', short_name: '写作', url: '/admin/write' },
  ],
}), {
  headers: {
    'Content-Type': 'application/manifest+json; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  },
})
