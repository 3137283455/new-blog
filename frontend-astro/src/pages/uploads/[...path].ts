import type { APIRoute } from 'astro'
import { proxyToBackend } from '@/lib/server-proxy'

export const prerender = false

export const ALL: APIRoute = ({ request, params }) => {
  const suffix = String(params.path || '').replace(/^\/+/, '')
  return proxyToBackend(request, `/uploads/${suffix}`)
}
