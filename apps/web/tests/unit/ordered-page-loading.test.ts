import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOrderedPageLoadingState,
  settleOrderedPage,
} from '../../src/features/manga/ordered-page-loading';

test('reader starts front-first, then fills a six-request pipeline without revealing out of order', () => {
  let state = createOrderedPageLoadingState(12, 'chapter-a');
  assert.equal(state.requestedThrough, 1);
  assert.equal(state.revealedThrough, -1);

  state = settleOrderedPage(state, 1, 'loaded');
  assert.equal(state.requestedThrough, 2);
  assert.equal(state.revealedThrough, -1);

  state = settleOrderedPage(state, 0, 'loaded');
  assert.equal(state.requestedThrough, 7);
  assert.equal(state.revealedThrough, 1);

  state = settleOrderedPage(state, 3, 'loaded');
  assert.equal(state.requestedThrough, 8);
  assert.equal(state.revealedThrough, 1);

  state = settleOrderedPage(state, 2, 'loaded');
  assert.equal(state.requestedThrough, 9);
  assert.equal(state.revealedThrough, 3);

  const settled = state.statuses.filter((status) => status !== 'idle').length;
  assert.ok(state.requestedThrough + 1 - settled <= 6);
});

test('a failed page does not permanently block the pages after it', () => {
  let state = createOrderedPageLoadingState(10, 'chapter-b');
  state = settleOrderedPage(state, 0, 'error');
  assert.equal(state.revealedThrough, 0);
  assert.equal(state.requestedThrough, 6);
});
