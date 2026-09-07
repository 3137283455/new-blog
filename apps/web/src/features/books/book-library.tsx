'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ensurePrivateDeviceToken } from '../../shared/device/private-device';
import type { BookProgress, BookSummary } from './contracts';

const statusLabels: Record<string, string> = {
  reading: '在读',
  finished: '读完',
  planned: '想读',
  paused: '暂放',
};

function statusLabel(status?: string) {
  return statusLabels[status || 'reading'] || '在读';
}

function cardHref(book: BookSummary) {
  return book.reading_mode === 'chapters' || !book.reading_mode
    ? `/books/${encodeURIComponent(book.slug)}`
    : book.reading_url || `/books/${encodeURIComponent(book.slug)}`;
}

function isExternal(book: BookSummary) {
  return book.reading_mode === 'external' || book.reading_mode === 'document';
}

function percent(progress?: BookProgress) {
  return Math.max(0, Math.min(1, Number(progress?.overall_progress) || 0));
}

function progressHref(progress?: BookProgress) {
  if (!progress?.slug || !progress.volume_slug || !progress.chapter_slug) return '';
  return `/books/${encodeURIComponent(progress.slug)}/${encodeURIComponent(progress.volume_slug)}/${encodeURIComponent(progress.chapter_slug)}?at=${Math.max(0, Math.min(1, Number(progress.chapter_progress) || 0))}`;
}

export function BookLibrary({ books }: { books: BookSummary[] }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [progress, setProgress] = useState<BookProgress[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('boke_library_view');
    if (saved === 'list') setView('list');
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    void (async () => {
      const token = await ensurePrivateDeviceToken('/api');
      if (!token || disposed) return;
      try {
        const response = await fetch('/api/private/library', {
          headers: { 'X-Device-Token': token },
          signal: controller.signal,
        });
        const json = await response.json();
        if (!disposed && response.ok && Array.isArray(json.data)) setProgress(json.data);
      } catch {
        // A missing private device should not make the public shelf unusable.
      }
    })();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, []);

  const statusCounts = useMemo(
    () => ({
      all: books.length,
      reading: books.filter((book) => (book.reading_status || 'reading') === 'reading').length,
      finished: books.filter((book) => book.reading_status === 'finished').length,
      planned: books.filter((book) => book.reading_status === 'planned').length,
      paused: books.filter((book) => book.reading_status === 'paused').length,
    }),
    [books],
  );
  const progressMap = useMemo(
    () => new Map(progress.map((item) => [String(item.id), item])),
    [progress],
  );
  const visibleBooks = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const filtered = books.filter((book) => {
      const matchesStatus = filter === 'all' || (book.reading_status || 'reading') === filter;
      const matchesQuery = !term || [book.title, book.author, book.description].some((value) =>
        String(value || '').toLocaleLowerCase().includes(term),
      );
      return matchesStatus && matchesQuery;
    });
    return [...filtered].sort((left, right) => {
      if (sort === 'title') return left.title.localeCompare(right.title, 'zh-CN');
      if (sort === 'author') return (left.author || '').localeCompare(right.author || '', 'zh-CN');
      if (sort === 'length') return Number(right.chapter_count || 0) - Number(left.chapter_count || 0);
      if (sort === 'progress') return percent(progressMap.get(String(right.id))) - percent(progressMap.get(String(left.id)));
      return (right.updated_at || '').localeCompare(left.updated_at || '');
    });
  }, [books, filter, progressMap, query, sort]);

  const latest = progress.find((item) => item.volume_slug && item.chapter_slug);
  const latestBook = latest ? books.find((book) => String(book.id) === String(latest.id)) : undefined;
  const setShelfView = (next: 'grid' | 'list') => {
    setView(next);
    localStorage.setItem('boke_library_view', next);
  };
  const randomBook = () => {
    const book = visibleBooks[Math.floor(Math.random() * visibleBooks.length)];
    if (book) window.location.href = cardHref(book);
  };

  return (
    <section className="library-page" data-library-refactor="">
      <header className="library-intro">
        <div className="intro-copy">
          <p className="eyebrow">
            YOUR READING ROOM <span>·</span> {books.length ? 'ACTIVE COLLECTION' : 'READY TO BEGIN'}
          </p>
          <h1>书库</h1>
          <p className="intro-description">把正在读的、想读的和读过的故事，放在一个安静而有秩序的地方。</p>
        </div>
        <div className="library-stats" aria-label="书库统计">
          <div><strong>{books.length}</strong><span>藏书</span></div>
          <div><strong>{books.reduce((sum, book) => sum + Number(book.volume_count || 0), 0)}</strong><span>分卷</span></div>
          <div><strong>{books.reduce((sum, book) => sum + Number(book.chapter_count || 0), 0)}</strong><span>章节</span></div>
        </div>
      </header>

      <section className="continue-card" data-library-continue="" hidden={!latest}>
        <div className="continue-mark"><span>CONTINUE</span><i>↗</i></div>
        <div className="continue-cover" data-continue-cover-wrap="">
          {latestBook?.cover && <img data-continue-cover="" src={latestBook.cover} alt={`${latestBook.title}封面`} />}
        </div>
        <div className="continue-copy">
          <p>LAST OPENED</p>
          <h2 data-continue-title="">{latest?.title || '继续阅读'}</h2>
          <span data-continue-chapter="">{latest ? `${latest.volume_title ? `${latest.volume_title} · ` : ''}${latest.chapter_title || '继续上次阅读'}` : '从上次停下的地方继续'}</span>
          <div className="continue-progress"><i data-continue-bar="" style={{ width: `${Math.max(1, Math.round(percent(latest) * 100))}%` }} /></div>
          <small data-continue-progress="">{latest ? `第 ${latest.chapter_number || 1} / ${latest.chapter_count || 1} 章 · 全书 ${Math.round(percent(latest) * 100)}%` : ''}</small>
        </div>
        <a className="continue-link" data-continue-link="" href={progressHref(latest) || '/books'}>打开阅读 <span>→</span></a>
      </section>

      <div className="library-layout">
        <section className="collection-card">
          <header className="collection-head"><div><p className="eyebrow">MY COLLECTION</p><h2>我的藏书</h2></div><span data-library-count="">{visibleBooks.length} 本书</span></header>
          <div className="library-toolbar">
            <nav className="filter-tabs" aria-label="书库状态">
              {(['all', 'reading', 'planned', 'finished', 'paused'] as const).map((value) => (
                <button key={value} className={filter === value ? 'is-active' : ''} type="button" data-library-filter={value} onClick={() => setFilter(value)}>
                  {value === 'all' ? '全部' : statusLabel(value)} <span>{statusCounts[value]}</span>
                </button>
              ))}
            </nav>
            <div className="toolbar-controls">
              <label className="library-search"><span>⌕</span><input ref={searchRef} type="search" data-library-search="" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索书名、作者" autoComplete="off" /><kbd>/</kbd></label>
              <select data-library-sort="" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="书籍排序"><option value="updated">最近整理</option><option value="title">书名</option><option value="author">作者</option><option value="length">章节数</option><option value="progress">阅读进度</option></select>
              <button className="random-book" type="button" data-random-book="" onClick={randomBook}>随机一本</button>
              <div className="view-switch" aria-label="视图切换"><button type="button" data-library-view="grid" className={view === 'grid' ? 'is-active' : ''} onClick={() => setShelfView('grid')} aria-label="封面网格">▦</button><button type="button" data-library-view="list" className={view === 'list' ? 'is-active' : ''} onClick={() => setShelfView('list')} aria-label="列表视图">☷</button></div>
            </div>
          </div>
          <div className="collection-meta"><span>选择一本书开始阅读</span><small>进度会在你的私人设备之间同步</small></div>
          <div className="book-shelf" data-book-shelf="" data-view={view}>
            {visibleBooks.map((book) => {
              const href = cardHref(book);
              const external = isExternal(book);
              const state = progressMap.get(String(book.id));
              const modeLabel = book.reading_mode === 'external' ? '站外阅读' : book.reading_mode === 'document' ? (book.source_format || '文档').toUpperCase() : statusLabel(book.reading_status);
              return (
                <article key={book.id} className="book-tile" data-book-card="" data-id={book.id} data-title={(book.title || '').toLocaleLowerCase()} data-author={(book.author || '').toLocaleLowerCase()} data-description={(book.description || '').toLocaleLowerCase()} data-status={book.reading_status || 'reading'} data-updated={book.updated_at || ''} data-chapters={book.chapter_count || 0} data-progress={percent(state)}>
                  <a className="book-tile-cover" href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{book.cover ? <img src={book.cover} alt={`${book.title}封面`} loading="lazy" decoding="async" /> : <span className="cover-fallback">{book.title.slice(0, 1)}</span>}<b>{modeLabel}</b><i className="cover-glow" /></a>
                  <div className="book-tile-copy"><small>{book.author || '作者未填写'}</small><h3><a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{book.title}</a></h3><p>{book.description || `${book.volume_count || 0} 卷 · ${book.chapter_count || 0} 章`}</p><div className="book-progress" data-book-progress="" hidden={!state}><i style={{ width: `${Math.max(1, Math.round(percent(state) * 100))}%` }} /><span>全书 {Math.round(percent(state) * 100)}%</span></div><footer><span>{book.reading_mode === 'external' ? '外部链接' : book.reading_mode === 'document' ? `${(book.source_format || '文档').toUpperCase()} 文档` : `${book.volume_count || 0} 卷 · ${book.chapter_count || 0} 章`}</span><a data-book-action="" href={progressHref(state) || href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{state?.volume_slug && state.chapter_slug ? '继续 →' : book.reading_mode === 'external' ? '前往 ↗' : book.reading_mode === 'document' ? '打开 ↗' : '详情 →'}</a></footer></div>
                </article>
              );
            })}
          </div>
          <div className="library-empty" data-library-empty="" hidden={visibleBooks.length > 0 || books.length === 0}><strong>没有匹配的书籍</strong><span>试试更短的关键词，或者换一个阅读状态。</span></div>
          {!books.length && <div className="library-empty is-empty"><strong>书架还是空的</strong><span>从后台导入 EPUB、TXT、Markdown、PDF，或添加外部阅读链接。</span><a href="/admin">前往内容中心 →</a></div>}
        </section>
        <aside className="library-rail">
          <section className="rail-card status-card"><header><p className="eyebrow">READING STATUS</p><span>本次整理</span></header><div className="status-list">{(['reading', 'planned', 'finished', 'paused'] as const).map((value) => <button key={value} type="button" data-library-filter={value} onClick={() => setFilter(value)}><i className={`status-dot is-${value}`} /><span>{value === 'reading' ? '正在阅读' : value === 'planned' ? '准备阅读' : value === 'finished' ? '已经读完' : '暂时搁置'}</span><strong>{statusCounts[value]}</strong><b>→</b></button>)}</div></section>
          <section className="rail-card library-note"><p className="eyebrow">A SMALL NOTE</p><blockquote>“读书不是为了抵达某处，而是为了在每个当下，拥有自己的房间。”</blockquote><span>— 阅读空间</span></section>
          <a className="rail-link" href="/reading"><span>阅读中心</span><small>查看所有阅读记录 ↗</small></a>
        </aside>
      </div>
    </section>
  );
}
