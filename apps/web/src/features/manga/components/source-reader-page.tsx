'use client';
import type { SourceKind } from '../source-detail';
import type { SourceReader } from '../source-reader';
import { useOrderedPageLoading } from '../use-ordered-page-loading';
import { useSourceReader } from '../use-source-reader';
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
  const pageLoading = useOrderedPageLoading(
    kind === 'manga' ? pages.length : 0,
    `${source}\0${workId}\0${chapterId}`,
  );
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
            {pages.map((url, index) => {
              const shouldRequest = pageLoading.shouldRequest(index, state.current, state.mode);
              const loadState = pageLoading.pageState(index, state.current, state.mode);
              return (
                <figure
                  key={`${index}:${url}`}
                  data-reader-figure=""
                  data-index={index}
                  data-load-state={loadState}
                  aria-busy={['queued', 'loading', 'waiting'].includes(loadState)}
                  className={`${index === state.current ? 'is-current ' : ''}is-page-${loadState}`}
                >
                  <img
                    ref={(image) => {
                      if (!image?.complete || !shouldRequest) return;
                      pageLoading.settle(index, image.naturalWidth ? 'loaded' : 'error');
                    }}
                    src={shouldRequest ? mediaUrl(url) : undefined}
                    alt={`${reader.title} 第 ${index + 1} 页`}
                    loading="eager"
                    decoding="async"
                    fetchPriority={index === 0 || index === state.current ? 'high' : 'auto'}
                    onLoad={() => pageLoading.settle(index, 'loaded')}
                    onError={() => pageLoading.settle(index, 'error')}
                  />
                  {loadState !== 'ready' && (
                    <span
                      className="source-reader-page-placeholder"
                      aria-live={loadState === 'error' ? 'polite' : undefined}
                    >
                      <b>{String(index + 1).padStart(2, '0')}</b>
                      <small>
                        {loadState === 'error'
                          ? '本页加载失败'
                          : loadState === 'waiting'
                            ? '等待前页显示'
                            : loadState === 'loading'
                              ? '正在加载本页'
                              : '等待前页加载'}
                      </small>
                    </span>
                  )}
                  <figcaption>第 {index + 1} 页</figcaption>
                </figure>
              );
            })}
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
