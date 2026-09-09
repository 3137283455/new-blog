'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createOrderedPageLoadingState,
  settleOrderedPage,
  type OrderedPageStatus,
} from './ordered-page-loading';

export type ReaderPageLoadState = 'queued' | 'loading' | 'waiting' | 'ready' | 'error';

export function useOrderedPageLoading(count: number, identity: string) {
  const [loading, setLoading] = useState(() => createOrderedPageLoadingState(count, identity));

  useEffect(() => {
    setLoading(createOrderedPageLoadingState(count, identity));
  }, [count, identity]);

  const active =
    loading.identity === identity && loading.statuses.length === count
      ? loading
      : createOrderedPageLoadingState(count, identity);

  const settle = useCallback(
    (index: number, status: Exclude<OrderedPageStatus, 'idle'>) => {
      setLoading((current) =>
        current.identity === identity ? settleOrderedPage(current, index, status) : current,
      );
    },
    [identity],
  );

  const shouldRequest = (index: number, current: number, mode: 'paged' | 'scroll') =>
    index <= active.requestedThrough || (mode === 'paged' && Math.abs(index - current) <= 1);

  const pageState = (
    index: number,
    current: number,
    mode: 'paged' | 'scroll',
  ): ReaderPageLoadState => {
    const status = active.statuses[index] || 'idle';
    const canReveal = mode === 'paged' || index <= active.revealedThrough;
    if (status === 'loaded') return canReveal ? 'ready' : 'waiting';
    if (status === 'error') return canReveal ? 'error' : 'waiting';
    return shouldRequest(index, current, mode) ? 'loading' : 'queued';
  };

  return { settle, shouldRequest, pageState };
}
