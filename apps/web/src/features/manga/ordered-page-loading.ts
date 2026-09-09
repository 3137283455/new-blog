export type OrderedPageStatus = 'idle' | 'loaded' | 'error';

export interface OrderedPageLoadingState {
  identity: string;
  requestedThrough: number;
  revealedThrough: number;
  statuses: OrderedPageStatus[];
}

const INITIAL_CONCURRENCY = 2;
const FULL_CONCURRENCY = 6;

export function createOrderedPageLoadingState(
  count: number,
  identity: string,
): OrderedPageLoadingState {
  return {
    identity,
    requestedThrough: count > 0 ? Math.min(count - 1, INITIAL_CONCURRENCY - 1) : -1,
    revealedThrough: -1,
    statuses: Array.from({ length: count }, () => 'idle' as const),
  };
}

export function settleOrderedPage(
  state: OrderedPageLoadingState,
  index: number,
  status: Exclude<OrderedPageStatus, 'idle'>,
): OrderedPageLoadingState {
  if (index < 0 || index >= state.statuses.length || state.statuses[index] !== 'idle') return state;

  const statuses = [...state.statuses];
  statuses[index] = status;
  let revealedThrough = state.revealedThrough;
  while (revealedThrough + 1 < statuses.length && statuses[revealedThrough + 1] !== 'idle')
    revealedThrough += 1;

  const settledCount = statuses.reduce(
    (total, pageStatus) => total + Number(pageStatus !== 'idle'),
    0,
  );
  const concurrency = statuses[0] === 'idle' ? INITIAL_CONCURRENCY : FULL_CONCURRENCY;

  return {
    ...state,
    statuses,
    revealedThrough,
    requestedThrough: Math.min(
      statuses.length - 1,
      Math.max(state.requestedThrough, settledCount + concurrency - 1),
    ),
  };
}
