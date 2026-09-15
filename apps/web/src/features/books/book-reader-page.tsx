'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BookChapterResponse } from './contracts';
import { ensurePrivateDeviceToken } from '../../shared/device/private-device';
import { MobileReaderShell } from '../../shared/reader/mobile-reader-shell';
import { MobileReaderMusic } from '../../shared/reader/mobile-reader-music';
import './reader-controls.css';

const defaults = {
  theme: 'day',
  mode: 'scroll',
  size: 20,
  line: 1.9,
  width: 760,
  margin: 20,
  font: 'serif',
  background: '#f6efdc',
};
export function BookReaderPage({
  data,
  requestedPosition = null,
}: {
  data: BookChapterResponse;
  requestedPosition?: number | null;
}) {
  const { book, chapter, navigation } = data;
  const index = navigation.findIndex((item) => item.id === chapter.id);
  const previous = navigation[index - 1],
    next = navigation[index + 1];
  const contentsUrl = '/books/' + encodeURIComponent(book.slug) + '#contents';
  const [prefs, setPrefs] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const article = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const position = useRef(0);
  const [pages, setPages] = useState({ current: 1, total: 1 });
  const update = (values: Partial<typeof defaults>) => setPrefs((old) => ({ ...old, ...values }));
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('boke-book-reader-appearance') || '{}');
      setPrefs({
        theme: ['day', 'paper', 'eye', 'night', 'custom'].includes(saved.theme)
          ? saved.theme
          : localStorage.getItem('boke-book-reader-theme') || 'day',
        mode: saved.mode === 'paged' ? 'paged' : 'scroll',
        size: Math.max(14, Math.min(32, Number(saved.size) || 20)),
        line: Math.max(1.4, Math.min(2.6, Number(saved.line) || 1.9)),
        width: Math.max(560, Math.min(960, Number(saved.width) || 760)),
        margin: Math.max(12, Math.min(48, Number(saved.margin) || 20)),
        font: saved.font === 'sans-serif' ? 'sans-serif' : 'serif',
        background: /^#[0-9a-f]{6}$/i.test(saved.background)
          ? saved.background
          : defaults.background,
      });
    } catch {
      /* Private browsing may disable storage. */
    }
    position.current = Math.max(0, Math.min(1, Number(requestedPosition) || 0));
    setReady(true);
  }, [chapter.id, requestedPosition]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem('boke-book-reader-appearance', JSON.stringify(prefs));
    } catch {}
    const element = article.current;
    const measure = () => {
      if (!element) return;
      const paged = prefs.mode === 'paged';
      const max = paged
        ? element.scrollWidth - element.clientWidth
        : document.documentElement.scrollHeight - innerHeight;
      const offset = paged ? element.scrollLeft : scrollY;
      position.current = max > 0 ? Math.max(0, Math.min(1, offset / max)) : 0;
      setProgress(position.current);
      const step = element.clientWidth + 32;
      setPages({
        current: Math.round(element.scrollLeft / step) + 1,
        total: Math.max(1, Math.ceil((element.scrollWidth + 32) / step)),
      });
    };
    const restore = () => {
      if (!element) return;
      if (prefs.mode === 'paged')
        element.scrollLeft = position.current * (element.scrollWidth - element.clientWidth);
      else
        window.scrollTo({
          top: position.current * Math.max(0, document.documentElement.scrollHeight - innerHeight),
          behavior: 'instant',
        });
      measure();
    };
    const frame = requestAnimationFrame(restore);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', restore);
    element?.addEventListener('scroll', measure, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', restore);
      element?.removeEventListener('scroll', measure);
    };
  }, [ready, prefs, chapter.id]);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(async () => {
      try {
        const token = await ensurePrivateDeviceToken('/api');
        if (token)
          await fetch('/api/private/books/' + book.id + '/progress', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Device-Token': token },
            body: JSON.stringify({
              volume_id: chapter.volume_id,
              chapter_id: chapter.id,
              position: progress,
              mode: prefs.mode,
              settings: prefs,
            }),
          });
      } catch {
        /* Reading remains available when offline. */
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [ready, progress, prefs, book.id, chapter.id, chapter.volume_id]);
  const turn = (direction: number) =>
    article.current?.scrollBy({
      left: direction * (article.current.clientWidth + 32),
      behavior: 'smooth',
    });
  const chapterUrl = (item: typeof chapter) =>
    '/books/' +
    encodeURIComponent(book.slug) +
    '/' +
    encodeURIComponent(item.volume_slug || '') +
    '/' +
    encodeURIComponent(item.slug);
  const colors: Record<string, string> = {
    day: '#fafaf8',
    paper: '#f6efdc',
    eye: '#e9f1e8',
    night: '#1d211f',
    custom: prefs.background,
  };
  return (
    <div
      className="reading-workspace"
      data-theme={prefs.theme}
      data-mode={prefs.mode}
      data-controls={controlsOpen}
      onClick={(event) => {
        if (innerWidth > 760 || (event.target as HTMLElement).closest('a,button,input,select,dialog')) return;
        const x = event.clientX / innerWidth;
        if (x > .28 && x < .72) setControlsOpen((value) => !value);
      }}
      style={
        {
          '--reading-bg': colors[prefs.theme] || colors.day,
          '--reading-size': prefs.size + 'px',
          '--reading-line': prefs.line,
          '--reading-width': prefs.width + 'px',
          '--reading-margin': prefs.margin + 'px',
          '--reading-font': prefs.font,
        } as CSSProperties
      }
    >
      <main className="reading-paper">
        <header className="reading-heading">
          <a href={contentsUrl}>← 目录</a>
          <small>{chapter.volume_title}</small>
          <h1>{chapter.title}</h1>
          <span>{Math.round(progress * 100)}%</span>
        </header>
        <article
          ref={article}
          className="reading-prose"
          dangerouslySetInnerHTML={{
            __html: chapter.content_html || '<p>本章还没有正文内容。</p>',
          }}
        />
        {prefs.mode === 'paged' && (
          <nav className="reading-pages" aria-label="本章翻页">
            <button disabled={pages.current <= 1} onClick={() => turn(-1)}>
              上一页
            </button>
            <span>
              {pages.current} / {pages.total}
            </span>
            <button disabled={pages.current >= pages.total} onClick={() => turn(1)}>
              下一页
            </button>
          </nav>
        )}
        <nav className="reading-chapters">
          {previous ? <a href={chapterUrl(previous)}>← {previous.title}</a> : <span />}
          {next ? (
            <a href={chapterUrl(next)}>{next.title} →</a>
          ) : (
            <a href={contentsUrl}>返回目录 →</a>
          )}
        </nav>
      </main>
      <aside className="reading-actions" aria-label="阅读工具">
        <a href={contentsUrl}>
          ☰<span>目录</span>
        </a>
        <button onClick={() => update({ theme: prefs.theme === 'night' ? 'day' : 'night' })}>
          ☾<span>夜间</span>
        </button>
        <button onClick={() => dialog.current?.showModal()}>
          Aa<span>设置</span>
        </button>
        <button
          onClick={() =>
            document.fullscreenElement
              ? void document.exitFullscreen()
              : void document.documentElement.requestFullscreen?.().catch(() => {})
          }
        >
          ⛶<span>沉浸</span>
        </button>
        <button
          onClick={() => {
            if (prefs.mode === 'paged') article.current?.scrollTo({ left: 0 });
            else window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          ↑<span>顶部</span>
        </button>
      </aside>
      <MobileReaderShell
        open={controlsOpen}
        onOpenChange={setControlsOpen}
        backHref={contentsUrl}
        title={chapter.title}
        subtitle={chapter.volume_title}
        progress={`${Math.round(progress * 100)}%`}
        actions={[
          { label: '目录', icon: '☰', onClick: () => setCatalogOpen(true) },
          { label: '夜间', icon: '☾', onClick: () => update({ theme: prefs.theme === 'night' ? 'day' : 'night' }) },
          { label: '设置', icon: 'Aa', primary: true, onClick: () => dialog.current?.showModal() },
          { label: '沉浸', icon: '⛶', onClick: () => document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen?.().catch(() => {}) },
          { label: '顶部', icon: '↑', onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
        ]}
      />
      <button
        className="reading-catalog-scrim"
        type="button"
        hidden={!catalogOpen}
        aria-label="关闭目录"
        onClick={() => setCatalogOpen(false)}
      />
      <aside className="reading-catalog" data-open={catalogOpen} aria-label="章节目录">
        <header>
          <div><small>{book.title}</small><h2>章节目录</h2></div>
          <button type="button" aria-label="关闭目录" onClick={() => setCatalogOpen(false)}>×</button>
        </header>
        <nav>
          {navigation.map((item, itemIndex) => (
            <a key={item.id} href={chapterUrl(item)} aria-current={item.id === chapter.id ? 'page' : undefined}>
              <span>{String(itemIndex + 1).padStart(2, '0')}</span>
              <div><strong>{item.title}</strong><small>{item.volume_title}</small></div>
            </a>
          ))}
        </nav>
      </aside>
      <dialog className="reading-settings" ref={dialog} aria-labelledby="reading-settings-title">
        <form method="dialog">
          <header>
            <h2 id="reading-settings-title">阅读设置</h2>
            <button aria-label="关闭阅读设置">×</button>
          </header>
          <label>
            字体
            <select value={prefs.font} onChange={(e) => update({ font: e.target.value })}>
              <option value="serif">宋体 / 衬线</option>
              <option value="sans-serif">黑体 / 无衬线</option>
            </select>
          </label>
          <label>
            字号 <output>{prefs.size}px</output>
            <input
              type="range"
              min="14"
              max="32"
              value={prefs.size}
              onChange={(e) => update({ size: Number(e.target.value) })}
            />
          </label>
          <label>
            行距 <output>{prefs.line.toFixed(1)}</output>
            <input
              type="range"
              min="1.4"
              max="2.6"
              step=".1"
              value={prefs.line}
              onChange={(e) => update({ line: Number(e.target.value) })}
            />
          </label>
          <label>
            正文宽度 <output>{prefs.width}px</output>
            <input
              type="range"
              min="560"
              max="960"
              step="40"
              value={prefs.width}
              onChange={(e) => update({ width: Number(e.target.value) })}
            />
          </label>
          <label>
            页边距 <output>{prefs.margin}px</output>
            <input
              type="range"
              min="12"
              max="48"
              step="2"
              value={prefs.margin}
              onChange={(e) => update({ margin: Number(e.target.value) })}
            />
          </label>
          <label>
            阅读方式
            <select value={prefs.mode} onChange={(e) => update({ mode: e.target.value })}>
              <option value="scroll">连续滚动</option>
              <option value="paged">横向分页</option>
            </select>
          </label>
          <fieldset>
            <legend>阅读背景</legend>
            <div className="reading-themes">
              {Object.entries({
                day: '日间',
                paper: '纸张',
                eye: '护眼',
                night: '夜间',
                custom: '自定义',
              }).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={prefs.theme === key}
                  onClick={() => update({ theme: key })}
                >
                  {label}
                </button>
              ))}
            </div>
            {prefs.theme === 'custom' && (
              <label>
                背景颜色
                <input
                  type="color"
                  value={prefs.background}
                  onChange={(e) => update({ background: e.target.value })}
                />
              </label>
            )}
          </fieldset>
          <MobileReaderMusic />
          <footer>
            <button type="button" onClick={() => setPrefs(defaults)}>
              恢复默认
            </button>
            <button className="primary">完成</button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
