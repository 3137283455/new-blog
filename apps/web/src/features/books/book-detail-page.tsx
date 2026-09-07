'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BookDetail, BookProgress, BookVolume } from './contracts';
import { ensurePrivateDeviceToken } from '../../shared/device/private-device';

function encode(value: string) { return encodeURIComponent(value); }

export function BookDetailPage({ book, volumes }: { book: BookDetail; volumes: BookVolume[] }) {
  const chapters = useMemo(() => volumes.flatMap((volume) => volume.chapters || []), [volumes]);
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState<BookProgress | null>(null);
  const [stateLabel, setStateLabel] = useState('未开始');

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const token = await ensurePrivateDeviceToken('/api');
      if (!token || disposed) return;
      try {
        const response = await fetch(`/api/private/books/${book.id}/progress`, { headers: { 'X-Device-Token': token } });
        const json = await response.json();
        if (!disposed && response.ok && json.data) {
          setProgress(json.data);
          setStateLabel(Number(json.data.position) >= 1 ? '已读' : '阅读中');
        }
      } catch { /* public details remain available without private sync */ }
    })();
    return () => { disposed = true; };
  }, [book.id]);

  const visibleVolumes = volumes.map((volume) => ({
    ...volume,
    chapters: (volume.chapters || []).filter((chapter) => !query.trim() || `${volume.title} ${chapter.title}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
  })).filter((volume) => volume.chapters?.length || !query.trim());
  const first = chapters[0];
  const current = progress ? chapters.find((chapter) => chapter.id === Number(progress.chapter_id)) : undefined;
  const startHref = current
    ? `/books/${encode(book.slug)}/${encode(current.volume_slug || '')}/${encode(current.slug)}?at=${Math.max(0, Math.min(1, Number(progress?.position) || 0))}`
    : first
      ? `/books/${encode(book.slug)}/${encode(first.volume_slug || volumes.find((volume) => volume.chapters?.some((item) => item.id === first.id))?.slug || '')}/${encode(first.slug)}`
      : '#contents';
  const readingMode = book.reading_mode || 'chapters';
  const external = readingMode === 'external' || readingMode === 'document';
  const startLabel = readingMode === 'external' ? '前往外部阅读' : readingMode === 'document' ? `打开 ${(book.source_format || '文档').toUpperCase()}` : current ? '继续阅读' : first ? '开始阅读' : '暂无章节';

  return (
    <article className="book-page" data-book-contents="" data-book-id={book.id} data-book-slug={book.slug}>
      <nav className="book-breadcrumb" aria-label="当前位置"><a href="/books">书库</a><span>/</span><b>{book.title}</b></nav>
      <header className="book-hero">
        <div className="book-cover">{book.cover ? <img src={book.cover} alt={`${book.title}封面`} /> : <span>{book.title.slice(0, 1)}</span>}</div>
        <div className="book-summary"><small>PERSONAL LIBRARY</small><h1>{book.title}</h1><p className="book-author">{book.author || '作者未填写'}</p><p className="book-description">{book.description || '这本书还没有简介。'}</p>
          <dl><div><dt>{external ? (readingMode === 'external' ? '站外' : '文档') : volumes.length}</dt><dd>{external ? '阅读方式' : '分卷'}</dd></div><div><dt>{external ? (readingMode === 'external' ? '外部' : (book.source_format || '文档').toUpperCase()) : (chapters.length || book.chapter_count || 0)}</dt><dd>{external ? '来源' : '章节'}</dd></div><div><dt data-reading-state="">{external ? '可直接打开' : stateLabel}</dt><dd>阅读状态</dd></div></dl>
          <div className="book-actions"><a className="book-primary" href={external ? book.reading_url || '#' : startHref} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{startLabel} <span>{external ? '↗' : '→'}</span></a>{!external && <a className="book-secondary" href="#contents">查看目录</a>}</div>
        </div>
      </header>
      <section className="book-introduction"><header><small>ABOUT THIS BOOK</small><h2>作品简介</h2></header><p>{book.description || '这本书还没有简介，可以在后台补充。'}</p></section>
      {!external && <section className="book-contents" id="contents"><header><div><small>ALL CHAPTERS</small><h2>目录</h2><p>{volumes.length} 卷 · {chapters.length || book.chapter_count || 0} 章</p></div><label><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索卷名或章节" /></label></header>
        <div className="book-volumes">{visibleVolumes.map((volume, volumeIndex) => <details className="book-volume" open={volumeIndex === 0} key={volume.id}><summary><span>{String(volumeIndex + 1).padStart(2, '0')}</span><div><h3>{volume.title}</h3><p>{volume.chapters?.length || 0} 章</p></div><i aria-hidden="true" /></summary><ol>{(volume.chapters || []).map((chapter, chapterIndex) => <li key={chapter.id}><a className={progress?.chapter_id === chapter.id ? 'is-last-read' : ''} href={`/books/${encode(book.slug)}/${encode(volume.slug)}/${encode(chapter.slug)}`}><span>{String(chapterIndex + 1).padStart(2, '0')}</span><b>{chapter.title}</b><small>{progress?.chapter_id === chapter.id ? `上次 ${Math.round((Number(progress.position) || 0) * 100)}%` : '阅读 →'}</small></a></li>)}</ol></details>)}</div>
        {!visibleVolumes.length && <div className="contents-empty"><b>没有匹配的章节</b><span>换一个关键词试试。</span></div>}
      </section>}
    </article>
  );
}
