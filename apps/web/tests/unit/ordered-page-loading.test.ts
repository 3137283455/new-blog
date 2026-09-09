import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOrderedPageLoadingState,
  settleOrderedPage,
} from '../../src/features/manga/ordered-page-loading';

test('reader requests a small front-first window and only advances contiguous pages', () => {
  let state = createOrderedPageLoadingState(8, 'chapter-a');
  assert.equal(state.requestedThrough, 1);
  assert.equal(state.revealedThrough, -1);

  state = settleOrderedPage(state, 1, 'loaded');
  assert.equal(state.requestedThrough, 1);
  assert.equal(state.revealedThrough, -1);

  state = settleOrderedPage(state, 0, 'loaded');
  assert.equal(state.requestedThrough, 3);
  assert.equal(state.revealedThrough, 1);

  state = settleOrderedPage(state, 3, 'loaded');
  assert.equal(state.requestedThrough, 3);
  assert.equal(state.revealedThrough, 1);

  state = settleOrderedPage(state, 2, 'loaded');
  assert.equal(state.requestedThrough, 5);
  assert.equal(state.revealedThrough, 3);
});

test('a failed page does not permanently block the pages after it', () => {
  let state = createOrderedPageLoadingState(3, 'chapter-b');
  state = settleOrderedPage(state, 0, 'error');
  assert.equal(state.revealedThrough, 0);
  assert.equal(state.requestedThrough, 2);
});
