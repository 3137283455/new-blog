import type { APIRoute } from 'astro'

const serviceWorker = String.raw`
const CACHE_NAME = 'boke-shell-v1';
const SHELL_URLS = ['/', '/archive', '/search', '/nav', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/admin')) return;

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
`

export const GET: APIRoute = () => new Response(serviceWorker, {
  headers: {
    'Content-Type': 'text/javascript; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Service-Worker-Allowed': '/',
  },
})
