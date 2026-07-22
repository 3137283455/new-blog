const INTERNAL_ORIGIN = process.env.API_BASE_INTERNAL || 'http://127.0.0.1:3001'

function forwardedHeaders(request: Request) {
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('connection')
  headers.delete('content-length')
  headers.set('x-forwarded-host', request.headers.get('host') || '')
  headers.set('x-forwarded-proto', new URL(request.url).protocol.replace(':', ''))
  return headers
}

export async function proxyToBackend(request: Request, pathname: string) {
  const sourceUrl = new URL(request.url)
  const targetUrl = new URL(pathname, INTERNAL_ORIGIN)
  targetUrl.search = sourceUrl.search

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: forwardedHeaders(request),
    redirect: 'manual',
    signal: request.signal,
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = request.body
    init.duplex = 'half'
  }

  try {
    const response = await fetch(targetUrl, init)
    const headers = new Headers(response.headers)
    headers.delete('content-length')
    headers.delete('content-encoding')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (cause) {
    return Response.json({
      success: false,
      code: 'BACKEND_UNAVAILABLE',
      message: cause instanceof Error ? cause.message : '后端服务暂时不可用',
    }, { status: 502 })
  }
}
