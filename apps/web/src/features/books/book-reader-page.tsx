'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BookChapterResponse } from './contracts';
import { ensurePrivateDeviceToken } from '../../shared/device/private-device';

export function BookReaderPage({ data, requestedPosition = null }: { data: BookChapterResponse; requestedPosition?: number | null }) {
  const { book, chapter, navigation } = data;
  const index = navigation.findIndex((item) => item.id === chapter.id);
  const previous = navigation[index - 1];
  const next = navigation[index + 1];
  const contentsUrl = `/books/${encodeURIComponent(book.slug)}#contents`;
  const [theme, setTheme] = useState('day');
  const [mode, setMode] = useState<'scroll' | 'paged'>('scroll');
  const [progress, setProgress] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);

  const save = async (value: number) => {
    const token = await ensurePrivateDeviceToken('/api');
    if (!token) return;
    try { await fetch(`/api/private/books/${book.id}/progress`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Device-Token': token }, body: JSON.stringify({ volume_id: chapter.volume_id, chapter_id: chapter.id, position: value, mode, settings: { theme } }) }); } catch { /* progress is best effort */ }
  };
  useEffect(() => {
    try { setTheme(localStorage.getItem('boke-book-reader-theme') || 'day'); setMode((localStorage.getItem('boke-book-reader-mode') as 'scroll' | 'paged') || 'scroll'); } catch { /* storage unavailable */ }
    const initial = Math.max(0, Math.min(1, Number(requestedPosition) || 0));
    const apply = () => { const max = document.documentElement.scrollHeight - window.innerHeight; setProgress(max > 0 ? window.scrollY / max : initial); };
    if (initial) requestAnimationFrame(() => window.scrollTo({ top: initial * Math.max(0, document.documentElement.scrollHeight - window.innerHeight), behavior: 'auto' }));
    window.addEventListener('scroll', apply, { passive: true }); apply();
    return () => window.removeEventListener('scroll', apply);
  }, [requestedPosition]);
  useEffect(() => { const timer = window.setTimeout(() => void save(progress), 900); return () => window.clearTimeout(timer); }, [progress, mode, theme]);
  const setReaderTheme = (value: string) => { setTheme(value); try { localStorage.setItem('boke-book-reader-theme', value); } catch {} };
  const setReaderMode = (value: 'scroll' | 'paged') => { setMode(value); try { localStorage.setItem('boke-book-reader-mode', value); } catch {} };
  const shellStyle = useMemo(() => ({ '--reader-size': '20px', '--reader-line': '1.9' } as React.CSSProperties), []);
  return <div className="reader-shell" data-reader="" data-theme={theme} data-mode={mode} style={shellStyle}>
    <main className="reader-main"><header><button type="button" onClick={() => window.location.href = contentsUrl}>目录</button><div><small>{chapter.volume_title}</small><h1>{chapter.title}</h1></div><span>{Math.round(progress * 100)}%</span></header><article className="reader-content" dangerouslySetInnerHTML={{ __html: chapter.content_html || '<p>本章还没有正文内容。</p>' }} /><nav className="chapter-nav">{previous ? <a href={`/books/${encodeURIComponent(book.slug)}/${encodeURIComponent(previous.volume_slug || '')}/${encodeURIComponent(previous.slug)}`}>← {previous.title}</a> : <span />}{next ? <a href={`/books/${encodeURIComponent(book.slug)}/${encodeURIComponent(next.volume_slug || '')}/${encodeURIComponent(next.slug)}`}>{next.title} →</a> : <a href={`/books/${encodeURIComponent(book.slug)}/${encodeURIComponent(chapter.volume_slug || '')}`}>返回本卷目录 →</a>}</nav></main>
    <aside className="reader-tools" aria-label="阅读工具"><a href={contentsUrl} title="全书目录">☰<small>目录</small></a><button type="button" title="切换日间或夜间" onClick={() => setReaderTheme(theme === 'night' ? 'day' : 'night')}>☾<small>主题</small></button><button type="button" title="阅读设置" onClick={() => setSettingsOpen(true)}><b>Aa</b><small>设置</small></button><button type="button" title="返回顶部" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑<small>顶部</small></button></aside>
    <button className="reader-control-trigger" type="button" onClick={() => setControlsOpen(!controlsOpen)} aria-label="展开阅读工具">•••</button>
    {controlsOpen && <button className="reader-scrim" type="button" onClick={() => setControlsOpen(false)} aria-label="关闭阅读工具" />}
    {settingsOpen && <dialog className="reader-settings" open><form onSubmit={(event) => { event.preventDefault(); setSettingsOpen(false); }}><header><h2>阅读设置</h2><button type="button" onClick={() => setSettingsOpen(false)}>×</button></header><label>阅读方式<select value={mode} onChange={(event) => setReaderMode(event.target.value as 'scroll' | 'paged')}><option value="scroll">滚动</option><option value="paged">分页</option></select></label><label>主题<div className="theme-choices">{['day', 'paper', 'eye', 'night'].map((item) => <button key={item} type="button" className={theme === item ? 'is-active' : ''} onClick={() => setReaderTheme(item)}>{item === 'day' ? '日间' : item === 'paper' ? '纸张' : item === 'eye' ? '护眼' : '夜间'}</button>)}</div></label><button type="submit">完成</button></form></dialog>}
  </div>;
}
