import type { APIRoute } from 'astro'

export const GET: APIRoute = ({ redirect }) => redirect('/api/feed.json', 307)
