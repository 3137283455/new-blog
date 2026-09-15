export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export type ToastItem = { id: number; kind: ToastKind; message: string };
type Listener = (items: ToastItem[]) => void;
const durations: Record<ToastKind, number> = { success: 2000, info: 2500, warning: 3000, error: 4000 };
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const recent = new Map<string, number>();

function emit() { const snapshot = [...items]; listeners.forEach((listener) => listener(snapshot)); }
function dismiss(id: number) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}
function push(kind: ToastKind, value: unknown) {
  const message = String(value ?? '').trim();
  if (!message) return;
  const now = Date.now();
  const key = `${kind}:${message}`;
  if (items.some((item) => item.kind === kind && item.message === message)) return;
  if (now - (recent.get(key) || 0) < 1200) return;
  recent.set(key, now);
  for (const [entry, timestamp] of recent) if (now - timestamp > 10000) recent.delete(entry);
  const item = { id: nextId++, kind, message };
  items = [...items, item];
  while (items.length > 3) dismiss(items[0].id);
  emit();
  timers.set(item.id, setTimeout(() => dismiss(item.id), durations[kind]));
}
function clear() {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  if (!items.length) return;
  items = [];
  emit();
}
export const toast = {
  success: (message: unknown) => push('success', message),
  error: (message: unknown) => push('error', message),
  warning: (message: unknown) => push('warning', message),
  info: (message: unknown) => push('info', message),
  dismiss,
  clear,
  subscribe(listener: Listener) { listeners.add(listener); listener([...items]); return () => { listeners.delete(listener); }; },
  snapshot() { return [...items]; },
};
