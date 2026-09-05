import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RequestLane } from '../../src/shared/http/json';
import { mangaCoverHref, mangaDetailHref } from '../../src/features/manga/api';
import { themeCss } from '../../src/shared/site/settings';

test('new requests abort and invalidate older responses, including non-cancellable transports', () => {
  const lane = new RequestLane();
  const old = lane.begin();
  const current = lane.begin();
  assert.equal(old.signal.aborted, true);
  assert.equal(old.isCurrent(), false);
  assert.equal(current.isCurrent(), true);
});

test('unmount invalidates outstanding requests; a new mount can make requests', () => {
  const lane = new RequestLane();
  const request = lane.begin();
  lane.cancel();
  assert.equal(request.isCurrent(), false);
  assert.equal(lane.begin().isCurrent(), true);
});

test('legacy manga URLs preserve source keys and opaque external IDs', () => {
  assert.equal(
    mangaDetailHref('venera:Manga_dex', 'a/b?语言=中'),
    '/source/manga/venera%3AManga_dex/a%2Fb%3F%E8%AF%AD%E8%A8%80%3D%E4%B8%AD',
  );
  const cover = new URL(
    mangaCoverHref('venera:test', 'https://example.com/image?a=1&b=2'),
    'http://localhost',
  );
  assert.equal(cover.searchParams.get('url'), 'https://example.com/image?a=1&b=2');
  assert.equal(cover.searchParams.get('source'), 'venera:test');
  assert.equal(mangaCoverHref('venera:test'), '');
});

test('theme settings keep the existing defaults without allowing a style-tag escape', () => {
  assert.ok(themeCss({}).includes('--theme-title-font:Georgia, serif'));
  assert.ok(!themeCss({ title_font: '</style><script>alert(1)</script>' }).includes('<'));
});
