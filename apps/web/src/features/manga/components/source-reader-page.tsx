'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import '../styles/ReaderControls.css';
import type { SourceKind } from '../source-detail';
import type { SourceReader } from '../source-reader';
import { useSourceReader } from '../use-source-reader';
import { MobileReaderShell } from '../../../shared/reader/mobile-reader-shell';
import { MobileReaderMusic } from '../../../shared/reader/mobile-reader-music';

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
  const [appearance, setAppearance] = useState({ theme: 'night', width: 980 });
  const appearanceDialog = useRef<HTMLDialogElement>(null);
  const [mobileControls, setMobileControls] = useState(false);
  const [readerReady, setReaderReady] = useState(false);
  useEffect(() => setReaderReady(true), []);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('source-reader-appearance') || '{}');
      setAppearance({
        theme: ['night', 'paper', 'light'].includes(saved.theme) ? saved.theme : 'night',
        width: Math.max(560, Math.min(1400, Number(saved.width) || 980)),
      });
    } catch {}
  }, []);
  const changeAppearance = (values: Partial<typeof appearance>) => {
    const next = { ...appearance, ...values };
    setAppearance(next);
    try {
      localStorage.setItem('source-reader-appearance', JSON.stringify(next));
    } catch {}
  };
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
      data-reading-theme={appearance.theme}
      data-reader-ready={readerReady}
      style={{ '--source-reading-width': appearance.width + 'px' } as CSSProperties}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button,a,figcaption,dialog,input,select,label')) return;
        if (innerWidth <= 760) {
          const ratio = event.clientX / innerWidth;
          if (state.mode !== 'scroll' && ratio < .28) state.go(state.current - 1);
          else if (state.mode !== 'scroll' && ratio > .72) state.go(state.current + 1);
          else if (ratio > .28 && ratio < .72) setMobileControls((value) => !value);
          return;
        }
        const box = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientX - box.left) / box.width;
        if (state.mode === 'paged') state.go(state.current + (ratio < .5 ? -1 : 1));
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
            <button type="button" onClick={() => appearanceDialog.current?.showModal()}>
              设置
            </button>
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
      {kind === 'manga' && pages.length > 0 && (
        <MobileReaderShell
          open={mobileControls}
          onOpenChange={setMobileControls}
          backHref={backUrl}
          title={reader.title || '漫画阅读'}
          subtitle={sourceLabel}
          progress={`${state.current + 1} / ${pages.length}`}
          actions={[
            { label: '目录', icon: '☷', href: backUrl },
            { label: '上一页', icon: '←', disabled: state.current <= 0, onClick: () => state.go(state.current - 1) },
            { label: '下一页', icon: '→', primary: true, disabled: state.current >= pages.length - 1, onClick: () => state.go(state.current + 1) },
            { label: '设置', icon: 'Aa', onClick: () => appearanceDialog.current?.showModal() },
          ]}
        />
      )}
      <dialog
        ref={appearanceDialog}
        className="source-appearance-dialog"
        aria-labelledby="source-appearance-title"
      >
        <form method="dialog">
          <header>
            <h2 id="source-appearance-title">漫画阅读设置</h2>
            <button aria-label="关闭阅读设置">×</button>
          </header>
          <label>
            页面宽度 <output>{appearance.width}px</output>
            <input
              type="range"
              min="560"
              max="1400"
              step="40"
              value={appearance.width}
              onChange={(event) => changeAppearance({ width: Number(event.target.value) })}
            />
          </label>
          <label>
            背景
            <select
              value={appearance.theme}
              onChange={(event) => changeAppearance({ theme: event.target.value })}
            >
              <option value="light">日间</option>
              <option value="paper">纸张</option>
              <option value="night">夜间</option>
            </select>
          </label>
          <label>
            阅读方式
            <select
              value={state.mode}
              onChange={(event) => state.choose(event.target.value as 'scroll' | 'paged')}
            >
              <option value="scroll">连续滚动</option>
              <option value="paged">单页翻阅</option>
            </select>
          </label>
          <MobileReaderMusic />
          <button className="source-appearance-done">完成</button>
        </form>
      </dialog>
    </main>
  );
}
