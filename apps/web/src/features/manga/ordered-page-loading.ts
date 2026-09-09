export type OrderedPageStatus = 'idle' | 'loaded' | 'error';

export interface OrderedPageLoadingState {
  identity: string;
  requestedThrough: number;
  revealedThrough: number;
  statuses: OrderedPageStatus[];
}

const LOAD_AHEAD = 2;

export function createOrderedPageLoadingState(
  count: number,
  identity: string,
): OrderedPageLoadingState {
  return {
    identity,
    requestedThrough: count > 0 ? Math.min(count - 1, LOAD_AHEAD - 1) : -1,
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

  return {
    ...state,
    statuses,
    revealedThrough,
    requestedThrough: Math.min(
      statuses.length - 1,
      Math.max(state.requestedThrough, revealedThrough + LOAD_AHEAD),
    ),
  };
}
