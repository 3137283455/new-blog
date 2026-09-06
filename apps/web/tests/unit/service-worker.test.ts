import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { serviceWorker } from '../../src/features/pwa/service-worker';

function harness() {
  const handlers = new Map<string, (event: any) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const fetched: string[] = [];
  const key = (input: string | Request) =>
    new URL(typeof input === 'string' ? input : input.url, 'https://reader.test').href;
  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name)!;
      return {
        async match(input: string | Request) {
          return entries.get(key(input));
        },
        async put(input: string | Request, response: Response) {
          entries.set(key(input), response);
        },
        async delete(input: string | Request) {
          return entries.delete(key(input));
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async match(input: string | Request) {
      for (const entries of stores.values())
        if (entries.has(key(input))) return entries.get(key(input));
    },
  };
  let active = 0,
    maxActive = 0;
  runInNewContext(serviceWorker, {
    self: {
      addEventListener: (name: string, handler: (event: any) => void) =>
        handlers.set(name, handler),
      clients: { claim() {} },
    },
    location: { origin: 'https://reader.test' },
    URL,
    Response,
    AbortSignal,
    caches,
    fetch: async (input: string | Request) => {
      fetched.push(key(input));
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return new Response('asset', { status: key(input).includes('/broken') ? 500 : 200 });
    },
  });
  return { handlers, stores, caches, fetched, maxActive: () => maxActive };
}

test('offline job acknowledges only successful allowed assets, deduplicates and bounds concurrency', async () => {
  const h = harness();
  let job: Promise<void> | undefined;
  let reply: any;
  const assets = Array.from({ length: 20 }, (_, index) => `/uploads/page-${index}.jpg`);
  h.handlers.get('message')!({
    data: {
      type: 'CACHE_READING',
      urls: [
        ...assets,
        assets[0],
        '/broken',
        '//evil.test/x',
        '/\\evil.test/x',
        '/admin',
        '/api/private/reading-center',
        '/api/content-sources/media?url=image',
        42,
      ],
    },
    ports: [
      {
        postMessage: (value: unknown) => {
          reply = value;
        },
      },
    ],
    waitUntil: (value: Promise<void>) => {
      job = value;
    },
  });
  await job;
  assert.equal(reply.type, 'CACHE_READING_DONE');
  assert.equal(reply.saved, 21);
  assert.equal(reply.total, 22);
  assert.equal(h.fetched.length, 22);
  assert.equal(h.maxActive(), 8);
  assert.equal(
    h.fetched.some(
      (url) => url.includes('evil.test') || url.includes('/admin') || url.includes('/api/private'),
    ),
    false,
  );
});

test('offline media uses explicit reading cache and private API/Flight requests bypass caching', async () => {
  const h = harness();
  const cache = await h.caches.open('boke-reading-v1');
  await cache.put('/api/content-sources/media?url=page', new Response('saved-page'));
  let response: Promise<Response> | undefined;
  h.handlers.get('fetch')!({
    request: new Request('https://reader.test/api/content-sources/media?url=page'),
    respondWith: (value: Promise<Response>) => {
      response = value;
    },
  });
  assert.equal(await (await response!).text(), 'saved-page');
  assert.equal(h.fetched.length, 0);
  for (const [path, headers] of [
    ['/api/private/reading-center', {}],
    ['/admin', {}],
    ['/manga', { RSC: '1' }],
  ] as const) {
    let intercepted = false;
    h.handlers.get('fetch')!({
      request: new Request(`https://reader.test${path}`, { headers }),
      respondWith() {
        intercepted = true;
      },
    });
    assert.equal(intercepted, false);
  }
});

test('activation retains reading and unrelated application caches', async () => {
  const h = harness();
  for (const name of ['boke-reading-v1', 'boke-shell-v2', 'boke-shell-v1', 'another-app'])
    await h.caches.open(name);
  let job: Promise<void> | undefined;
  h.handlers.get('activate')!({
    waitUntil: (value: Promise<void>) => {
      job = value;
    },
  });
  await job;
  assert.deepEqual([...h.stores.keys()], ['boke-reading-v1', 'boke-shell-v2', 'another-app']);
});
