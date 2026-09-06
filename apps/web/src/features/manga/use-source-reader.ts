'use client';
import { useEffect, useRef, useState } from 'react';
export function useSourceReader(count: number) {
  const [mode, setMode] = useState<'paged' | 'scroll'>('scroll');
  const [current, setCurrent] = useState(0);
  const stage = useRef<HTMLElement>(null);
  const live = useRef({ mode, current });
  live.current = { mode, current };
  const clamp = (n: number) =>
    Math.max(0, Math.min(count - 1, Number.isFinite(n) ? Math.floor(n) : 0));
  const go = (index: number, selectedMode = live.current.mode) => {
    const value = clamp(index);
    setCurrent(value);
    if (selectedMode === 'scroll')
      stage.current
        ?.querySelectorAll('figure')
        [value]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const url = new URL(location.href);
    url.searchParams.set('page', String(value + 1));
    history.replaceState({}, '', url);
  };
  const choose = (value: 'paged' | 'scroll') => {
    setMode(value);
    try {
      localStorage.setItem('source_reader_mode', value);
    } catch {}
    if (value === 'paged') go(live.current.current, value);
  };
  useEffect(() => {
    if (!count) return;
    try {
      setMode(localStorage.getItem('source_reader_mode') === 'paged' ? 'paged' : 'scroll');
    } catch {}
    setCurrent(clamp(Number(new URLSearchParams(location.search).get('page') || 1) - 1));
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]'))
        return;
      if (['ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        go(live.current.current - 1);
      }
      if (['ArrowRight', 'PageDown'].includes(event.key)) {
        event.preventDefault();
        go(live.current.current + 1);
      }
    };
    window.addEventListener('keydown', key);
    const observer =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) => {
              if (live.current.mode !== 'scroll') return;
              const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
              if (visible) setCurrent(clamp(Number((visible.target as HTMLElement).dataset.index)));
            },
            { threshold: [0.35, 0.65] },
          )
        : null;
    stage.current?.querySelectorAll('figure').forEach((figure) => observer?.observe(figure));
    return () => {
      window.removeEventListener('keydown', key);
      observer?.disconnect();
    };
  }, [count]);
  return { mode, current, stage, go, choose };
}
