/** Own browser listeners and scheduled work so React remounts never duplicate them. */
export function createEffectScope() {
  const disposers: Array<() => void> = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const frames = new Set<number>();
  let disposed = false;
  return {
    defer(dispose: () => void) {
      if (disposed) dispose();
      else disposers.push(dispose);
    },
    listen(
      target: EventTarget | null | undefined,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (!target || disposed) return;
      target.addEventListener(type, listener, options);
      disposers.push(() => target.removeEventListener(type, listener, options));
    },
    timeout(callback: () => void, delay = 0) {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!disposed) callback();
      }, delay);
      timers.add(id);
      return id;
    },
    frame(callback: FrameRequestCallback) {
      const id = requestAnimationFrame((time) => {
        frames.delete(id);
        if (!disposed) callback(time);
      });
      frames.add(id);
      return id;
    },
    dispose() {
      disposed = true;
      disposers
        .splice(0)
        .reverse()
        .forEach((dispose) => dispose());
      timers.forEach(clearTimeout);
      frames.forEach(cancelAnimationFrame);
      timers.clear();
      frames.clear();
    },
  };
}
