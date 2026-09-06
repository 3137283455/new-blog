'use client';
import { useEffect, useRef, useState } from 'react';
import { ensurePrivateDeviceToken } from '../../shared/device/private-device';
import { defaultReaderSettings, readerSettings, type ReaderSettings } from './reader-settings';
import type { LocalReaderData } from './local-reader';

export function useLocalReader(data: LocalReaderData) {
  const count = data.chapter.pages?.length || 0;
  const [settings, setSettings] = useState(defaultReaderSettings),
    [current, setCurrent] = useState(0),
    [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState(false),
    [controls, setControls] = useState(false),
    [toast, setToast] = useState('');
  const stage = useRef<HTMLElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const token = useRef(''),
    revision = useRef(0),
    edit = useRef(0),
    queue = useRef(Promise.resolve());
  const live = useRef({ settings, current });
  const initialized = useRef(false);
  live.current = { settings, current };
  const clamp = (n: number) =>
    Math.max(0, Math.min(count - 1, Number.isFinite(n) ? Math.floor(n) : 0));
  const update = (patch: Partial<ReaderSettings>) => {
    edit.current++;
    const next = readerSettings({ ...live.current.settings, ...patch });
    live.current.settings = next;
    setSettings(next);
  };
  const go = (index: number, smooth = true) => {
    edit.current++;
    const next = clamp(index);
    live.current.current = next;
    setCurrent(next);
    if (live.current.settings.mode === 'scroll')
      stage.current
        ?.querySelectorAll('[data-page]')
        [next]?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };
  const save = (keepalive = false) => {
    if (!token.current) return Promise.resolve();
    const snapshot = { ...live.current };
    const payload = {
      volume_id: data.chapter.volume_id,
      chapter_id: data.chapter.id,
      page_index: snapshot.current,
      mode: snapshot.settings.mode,
      settings: snapshot.settings,
    };
    const send = async (force = false): Promise<void> => {
      try {
        const response = await fetch(`/api/private/manga/${data.manga.id}/progress`, {
          method: 'PUT',
          keepalive,
          headers: { 'Content-Type': 'application/json', 'X-Device-Token': token.current },
          body: JSON.stringify({ ...payload, revision: revision.current, force }),
        });
        const json = await response.json();
        if (response.status === 409 && !keepalive && !force) {
          if (confirm('另一台设备有更新，是否覆盖？')) await send(true);
        } else if (response.ok) revision.current = Number(json.data?.revision) || 0;
      } catch {}
    };
    queue.current = queue.current.catch(() => {}).then(() => send());
    return queue.current;
  };
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    document.documentElement.classList.add('comic-page');
    let local = defaultReaderSettings;
    try {
      local = readerSettings(JSON.parse(localStorage.getItem('comic_settings') || '{}'));
    } catch {}
    let page = clamp(Number(new URLSearchParams(location.search).get('page') || 1) - 1);
    initialized.current = false;
    live.current = { settings: local, current: page };
    setSettings(local);
    setCurrent(page);
    const initialEdit = edit.current;
    void (async () => {
      token.current = await ensurePrivateDeviceToken('/api');
      if (disposed) return;
      if (token.current)
        try {
          const response = await fetch(`/api/private/manga/${data.manga.id}/progress`, {
            headers: { 'X-Device-Token': token.current },
            signal: controller.signal,
          });
          const json = await response.json(),
            remote = json.data;
          if (disposed) return;
          if (response.ok && remote) {
            revision.current = Number(remote.revision) || 0;
            if (edit.current === initialEdit) {
              local = readerSettings({
                ...local,
                ...remote.settings,
                mode: remote.mode || local.mode,
              });
              if (!location.search && Number(remote.chapter_id) === data.chapter.id)
                page = clamp(Number(remote.page_index) || 0);
              live.current = { settings: local, current: page };
              setSettings(local);
              setCurrent(page);
            }
          }
        } catch {}
      if (!disposed) setReady(true);
    })();
    const key = (event: KeyboardEvent) => {
      if (
        dialog.current?.open ||
        (event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]')
      )
        return;
      const { settings, current } = live.current,
        step = settings.mode === 'double' ? 2 : 1;
      if (['ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        go(current + (settings.direction === 'rtl' ? step : -step));
      }
      if (['ArrowRight', 'PageDown'].includes(event.key)) {
        event.preventDefault();
        go(current + (settings.direction === 'rtl' ? -step : step));
      }
    };
    const unload = () => {
      void save(true);
    };
    window.addEventListener('keydown', key);
    window.addEventListener('pagehide', unload);
    const observer =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) => {
              if (!initialized.current || live.current.settings.mode !== 'scroll') return;
              const first = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
              if (first) {
                const page = clamp(Number((first.target as HTMLElement).dataset.index));
                live.current.current = page;
                setCurrent(page);
              }
            },
            { threshold: [0.35, 0.65] },
          )
        : null;
    stage.current?.querySelectorAll('[data-page]').forEach((page) => observer?.observe(page));
    return () => {
      disposed = true;
      controller.abort();
      observer?.disconnect();
      window.removeEventListener('keydown', key);
      window.removeEventListener('pagehide', unload);
      document.documentElement.classList.remove('comic-page');
    };
  }, [data.manga.id, data.chapter.id]);
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      // State was restored before rendering; never overwrite a key/click that arrived since.
      if (live.current.settings.mode === 'scroll')
        stage.current
          ?.querySelectorAll('[data-page]')
          [live.current.current]?.scrollIntoView({ behavior: 'auto' });
      initialized.current = true;
    });
    const timer = setTimeout(() => {
      if (innerWidth <= 760) setControls(true);
    }, 300);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem('comic_settings', JSON.stringify(settings));
    } catch {}
    const timer = setTimeout(() => {
      void save();
    }, 800);
    return () => clearTimeout(timer);
  }, [ready, current, settings]);
  useEffect(() => {
    if (!controls) return;
    const timer = setTimeout(() => setControls(false), 5500);
    return () => clearTimeout(timer);
  }, [controls]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 1500);
    return () => clearTimeout(timer);
  }, [toast]);
  const action = (name: string) => {
    const s = live.current.settings,
      step = s.mode === 'double' ? 2 : 1;
    if (name === 'catalog') setCatalog(true);
    if (name === 'settings') dialog.current?.showModal();
    if (name === 'previous') go(live.current.current - step);
    if (name === 'next') go(live.current.current + step);
    if (name === 'mode') {
      const mode = s.mode === 'scroll' ? 'paged' : s.mode === 'paged' ? 'double' : 'scroll';
      update({ mode });
      go(live.current.current, false);
      setToast(mode === 'paged' ? '单页翻阅' : mode === 'double' ? '双页阅读' : '连续滚动');
    }
    if (name === 'theme') update({ theme: s.theme === 'night' ? 'paper' : 'night' });
    if (name === 'fullscreen') {
      void (
        document.fullscreenElement
          ? document.exitFullscreen?.()
          : document.documentElement.requestFullscreen?.()
      )?.catch(() => {});
    }
    if (name === 'top') go(0);
    setControls(false);
  };
  return {
    settings,
    current,
    ready,
    stage,
    dialog,
    catalog,
    setCatalog,
    controls,
    setControls,
    toast,
    update,
    go,
    action,
  };
}
