import { createEffectScope } from '../../shared/browser/effect-scope';

/** The admin owns its DOM subtree, requests, temporary nodes and global bridge hooks. */
export function createAdminScope(host: HTMLElement) {
  const effects = createEffectScope();
  const controller = new AbortController();
  const moved = new Set<Node>();
  const query = (selector: string): Element | null => {
    if (host.matches(selector)) return host;
    const found = host.querySelector(selector);
    if (found) return found;
    for (const node of moved)
      if (node instanceof Element) {
        if (node.matches(selector)) return node;
        const child = node.querySelector(selector);
        if (child) return child;
      }
    return null;
  };
  for (const name of ['notifyAdmin', 'updateAdminFieldPreview']) {
    const record = window as unknown as Record<string, unknown>;
    const previous = record[name];
    effects.defer(() => {
      if (previous === undefined) delete record[name];
      else record[name] = previous;
    });
  }
  effects.defer(() => controller.abort());
  return {
    ...effects,
    get disposed() {
      return controller.signal.aborted;
    },
    query,
    byId(id: string) {
      return query('#' + CSS.escape(id));
    },
    notify(message: string, failed = false) {
      if (controller.signal.aborted) return;
      (
        window as unknown as { notifyAdmin?: (message: string, failed: boolean) => void }
      ).notifyAdmin?.(message, failed);
    },
    queryAll(selector: string) {
      return host.querySelectorAll(selector);
    },
    async fetch(input: RequestInfo | URL, init?: RequestInit) {
      controller.signal.throwIfAborted();
      const signal = init?.signal
        ? AbortSignal.any([controller.signal, init.signal])
        : controller.signal;
      const response = await fetch(input, { ...init, signal });
      controller.signal.throwIfAborted();
      return response;
    },
    moveToBody(node: Node) {
      if (!moved.has(node)) {
        const parent = node.parentNode,
          sibling = node.nextSibling;
        effects.defer(() => {
          if (parent) parent.insertBefore(node, sibling?.parentNode === parent ? sibling : null);
        });
        moved.add(node);
      }
      document.body.appendChild(node);
    },
  };
}
