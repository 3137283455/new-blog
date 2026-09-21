export const serviceWorker = String.raw`
const CACHE_NAME = 'boke-shell-v3';
const READING_CACHE = 'boke-reading-v1';
const PDF_CACHE = 'boke-pdf-v1';
const pdfJobs = new Map();
// Only pre-cache routes served by the standalone Next deployment. The former
// Only Next shell routes are part of the production service.
const SHELL_URLS = ['/manga', '/manga/search', '/reading'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('boke-') && ![CACHE_NAME, READING_CACHE, PDF_CACHE].includes(key)).map((key) => caches.delete(key)))));
  self.clients.claim();
});

function pdfUrl(value) {
  try {
    const url = new URL(value, location.origin);
    return url.origin === location.origin && /^\/api\/books\/[^/]+\/document\/file$/.test(url.pathname) && url.searchParams.get('download') !== '1' ? url : null;
  } catch { return null; }
}

async function cachedPdfResponse(request) {
  const url = pdfUrl(request.url);
  if (!url) return fetch(request);
  const cache = await caches.open(PDF_CACHE);
  const cacheKey = url.href;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const range = request.headers.get('range');
    if (!range) return cached.clone();
    const blob = await cached.blob();
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + blob.size } });
    let start = match[1] ? Number(match[1]) : Math.max(0, blob.size - Number(match[2] || 0));
    let end = match[2] && match[1] ? Number(match[2]) : blob.size - 1;
    start = Math.max(0, start);
    end = Math.min(blob.size - 1, end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= blob.size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + blob.size } });
    }
    const headers = new Headers(cached.headers);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + blob.size);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(blob.slice(start, end + 1, cached.headers.get('Content-Type') || 'application/pdf'), { status: 206, headers });
  }
  const response = await fetch(request);
  if (response.ok && response.status === 200) {
    const job = cache.put(cacheKey, response.clone()).catch(() => {}).finally(() => pdfJobs.delete(cacheKey));
    pdfJobs.set(cacheKey, job);
  }
  return response;
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'CACHE_READING' && Array.isArray(data.urls)) {
    event.waitUntil(caches.open(READING_CACHE).then(async (cache) => {
      const urls = [...new Set(data.urls.filter((value) => {
        if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return false;
        try { const url = new URL(value, location.origin); return url.origin === location.origin && !url.pathname.startsWith('/admin') && (!url.pathname.startsWith('/api/') || url.pathname === '/api/content-sources/media'); } catch { return false; }
      }))].slice(0,800);
      let cursor=0,saved=0;
      await Promise.all(Array.from({length:Math.min(8,urls.length)},async()=>{
        while(cursor<urls.length){ const url=urls[cursor++]; try {
          const response=await fetch(url,{credentials:'same-origin',signal:AbortSignal.timeout(30000)});
          if(response.ok){await cache.put(url,response.clone());saved++;}
        }catch{} }
      }));
      const result={type:'CACHE_READING_DONE',saved,total:urls.length};
      if(event.ports?.[0])event.ports[0].postMessage(result);else event.source?.postMessage(result);
    }));
  }
  if (data.type === 'REMOVE_READING' && Array.isArray(data.urls)) {
    event.waitUntil(caches.open(READING_CACHE).then((cache) => Promise.all(data.urls.map((url) => cache.delete(url)))));
  }
  if (data.type === 'CACHE_PDF') {
    const url = pdfUrl(data.url);
    const task = (async () => {
      let saved = false;
      if (url) {
        try {
          const cache = await caches.open(PDF_CACHE);
          if (pdfJobs.has(url.href)) await pdfJobs.get(url.href);
          if (await cache.match(url.href)) saved = true;
          else {
            const response = await fetch(url.href, { credentials: 'same-origin' });
            if (response.ok && response.status === 200) {
              const job = cache.put(url.href, response.clone()).finally(() => pdfJobs.delete(url.href));
              pdfJobs.set(url.href, job);
              await job;
              saved = true;
            }
          }
        } catch {}
      }
      const result = { type: 'CACHE_PDF_DONE', saved };
      if (event.ports?.[0]) event.ports[0].postMessage(result); else event.source?.postMessage(result);
    })();
    event.waitUntil(task);
  }
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  // Flight payloads are not HTML documents; never let them replace a cached page.
  if (request.headers.get('RSC') === '1') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/admin')) return;
  if (/^\/api\/books\/[^/]+\/document\/file$/.test(url.pathname) && url.searchParams.get('download') !== '1') {
    const response = cachedPdfResponse(request);
    event.respondWith(response);
    event.waitUntil?.(response.then(() => pdfJobs.get(url.href)).catch(() => {}));
    return;
  }
  if (url.pathname === '/api/content-sources/media') { event.respondWith(caches.open(READING_CACHE).then(cache=>cache.match(request)).then(cached=>cached||fetch(request))); return; }
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/uploads/')) {
    if (/\.pdf$/i.test(url.pathname) || request.headers.has('range')) { event.respondWith(fetch(request)); return; }
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('/')) || new Response(
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>暂时离线</title><style>body{font:16px system-ui;margin:0;display:grid;min-height:100vh;place-items:center;background:#f4f2ea;color:#1d251e}main{max-width:28rem;padding:2rem;text-align:center}a{color:#547158}</style><main><h1>暂时离线</h1><p>网络恢复后刷新页面，或返回已缓存的首页。</p><a href="/">返回首页</a></main></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
`;
