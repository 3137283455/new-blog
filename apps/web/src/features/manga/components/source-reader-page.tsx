'use client';
import { useState } from 'react';
import type { SourceKind } from '../source-detail';
import type { SourceReader } from '../source-reader';
import { useSourceReader } from '../use-source-reader';

function SourceReaderPageImage({
  src,
  title,
  index,
  current,
}: {
  src: string;
  title: string;
  index: number;
  current: boolean;
}) {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  return (
    <figure
      data-reader-figure=""
      data-index={index}
      data-load-state={loadState}
      aria-busy={loadState === 'loading'}
      className={current ? 'is-current' : ''}
    >
      <img
        ref={(image) => {
          if (image?.complete) setLoadState(image.naturalWidth ? 'ready' : 'error');
        }}
        src={src}
        alt={`${title} 第 ${index + 1} 页`}
        loading={index < 6 ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={index === 0 || current ? 'high' : 'low'}
        onLoad={() => setLoadState('ready')}
        onError={() => setLoadState('error')}
      />
      <span className="source-reader-page-placeholder">
        <b>{String(index + 1).padStart(2, '0')}</b>
        <small>
          {loadState === 'error' ? '本页加载失败' : index < 6 ? '正在加载本页' : '等待接近本页'}
        </small>
      </span>
      <figcaption>第 {index + 1} 页</figcaption>
    </figure>
  );
}

export function SourceReaderPage({
  kind,
  source,
  chapterId,
  workId,
  reader,
  sourceLabel,
}: {
  kind: SourceKind;
  source: string;
  chapterId: string;
  workId: string;
  reader: SourceReader;
  sourceLabel: string;
}) {
  const pages = reader.pages || [];
  const state = useSourceReader(kind === 'manga' ? pages.length : 0);
  const backUrl = `/source/${encodeURIComponent(kind)}/${encodeURIComponent(source)}/${encodeURIComponent(workId)}`;
  const mediaUrl = (url: string) =>
    `/api/content-sources/media?source=${encodeURIComponent(source)}&kind=${encodeURIComponent(kind)}&url=${encodeURIComponent(url)}&purpose=page&comic_id=${encodeURIComponent(workId)}&chapter_id=${encodeURIComponent(chapterId)}`;
  return (
    <main
      className={`source-reader-page${kind === 'manga' ? ' source-reader-manga' : ''}`}
      data-source-reader={kind === 'manga' && pages.length ? 'manga' : undefined}
      data-page-count={kind === 'manga' ? pages.length : 0}
      data-mode={kind === 'manga' && pages.length ? state.mode : undefined}
      onClick={(event) => {
        if (state.mode !== 'paged' || (event.target as HTMLElement).closest('button,a,figcaption'))
          return;
        const box = event.currentTarget.getBoundingClientRect();
        state.go(state.current + (event.clientX - box.left < box.width / 2 ? -1 : 1));
      }}
    >
      <header className="source-reader-topbar">
        <a className="reader-back" href={backUrl} aria-label="返回章节目录">
          ← <span>返回目录</span>
        </a>
        <div>
          <small>{sourceLabel}</small>
          <strong>{reader.title || '漫画阅读'}</strong>
        </div>
        <span data-reader-count="">
          {kind === 'manga'
            ? state.mode === 'paged'
              ? `${state.current + 1} / ${pages.length}`
              : `${pages.length} 页`
            : '源阅读'}
        </span>
      </header>
      {reader.error ? (
        <section className="source-reader-error">
          <strong>本章暂时无法加载</strong>
          <p>{reader.error}</p>
          <a href={backUrl}>返回章节目录</a>
        </section>
      ) : kind === 'manga' && pages.length ? (
        <>
          <nav className="source-reader-controls" aria-label="漫画阅读控制">
            <div className="source-reader-mode">
              <button
                type="button"
                data-reader-mode="scroll"
                className={state.mode === 'scroll' ? 'is-active' : ''}
                onClick={() => state.choose('scroll')}
              >
                连续
              </button>
              <button
                type="button"
                data-reader-mode="paged"
                className={state.mode === 'paged' ? 'is-active' : ''}
                onClick={() => state.choose('paged')}
              >
                单页
              </button>
            </div>
            <div className="source-reader-pagination">
              <button
                type="button"
                data-reader-prev=""
                disabled={state.current <= 0}
                onClick={() => state.go(state.current - 1)}
              >
                上一页
              </button>
              <span data-reader-page="">
                第 {state.current + 1} / {pages.length} 页
              </span>
              <button
                type="button"
                data-reader-next=""
                disabled={state.current >= pages.length - 1}
                onClick={() => state.go(state.current + 1)}
              >
                下一页
              </button>
            </div>
          </nav>
          <section className="source-reader-pages" data-reader-stage="" ref={state.stage}>
            {pages.map((url, index) => (
              <SourceReaderPageImage
                key={`${index}:${url}`}
                src={mediaUrl(url)}
                title={reader.title || '漫画'}
                index={index}
                current={index === state.current}
              />
            ))}
          </section>
        </>
      ) : reader.content_html ? (
        <article
          className="source-reader-content"
          dangerouslySetInnerHTML={{ __html: reader.content_html }}
        />
      ) : (
        <article className="source-reader-content">
          <p>{reader.content || '源站没有返回可读内容。'}</p>
        </article>
      )}
    </main>
  );
}
