'use client';
import type { CSSProperties } from 'react';
import { useLocalReader } from '../use-local-reader';
import { chapterHref, type LocalReaderData } from '../local-reader';
import type { ReaderSettings } from '../reader-settings';
export function LocalReaderPage({ data }: { data: LocalReaderData }) {
  const state = useLocalReader(data);
  const { manga, chapter, navigation } = data,
    pages = chapter.pages || [],
    at = navigation.findIndex((x) => x.id === chapter.id),
    prev = navigation[at - 1],
    next = navigation[at + 1];
  const link = (x?: typeof chapter) => chapterHref(manga.slug, x);
  return (
    <div
      className={`comic${state.settings.numbers ? ' numbers' : ''}${state.controls ? ' controls' : ''}`}
      data-mode={state.settings.mode}
      data-theme={state.settings.theme}
      style={
        {
          '--width': `${state.settings.width}px`,
          '--gap': `${state.settings.gap}px`,
          '--comic-direction': state.settings.direction,
          '--reader-progress': `${pages.length ? ((state.current + 1) / pages.length) * 100 : 0}%`,
        } as CSSProperties
      }
      data-comic=""
      data-mid={manga.id}
      data-vid={chapter.volume_id}
      data-cid={chapter.id}
    >
      <header className="top" aria-label="漫画阅读工具栏">
        <a className="reader-back" href={`/manga/${manga.slug}`} aria-label="返回漫画目录">
          <span className="reader-back-icon" aria-hidden="true">
            ‹
          </span>
          <span>返回目录</span>
        </a>
        <div className="reader-heading">
          <small>
            {manga.title} · {chapter.volume_title}
          </small>
          <b>{chapter.title}</b>
        </div>
        <div
          className="reader-status"
          aria-label={`第 ${state.current + 1} 页，共 ${pages.length} 页`}
        >
          <i data-page-label="">{state.current + 1}</i>
          <span>/ {String(pages.length).padStart(2, '0')}</span>
        </div>
        <span className="reader-progress" aria-hidden="true">
          <span />
        </span>
      </header>
      <main
        data-stage=""
        ref={state.stage}
        onClick={(event) => {
          if (innerWidth > 760 || (event.target as HTMLElement).closest('a,button')) return;
          const x = event.clientX / innerWidth,
            step = state.settings.mode === 'double' ? 2 : 1;
          if (state.settings.mode !== 'scroll' && x < 0.28) state.go(state.current - step);
          else if (state.settings.mode !== 'scroll' && x > 0.72) state.go(state.current + step);
          else state.setControls(!state.controls);
        }}
      >
        {pages.map((p, i) => {
          const src = p.image_url,
            isPdf = String(p.image_url || '')
              .toLowerCase()
              .endsWith('.pdf');
          return (
            <figure
              key={i}
              className={i === state.current ? 'current' : ''}
              data-page=""
              data-index={i}
            >
              {isPdf ? (
                <iframe src={src} title={`${chapter.title} 第 ${i + 1} 页`}></iframe>
              ) : (
                <img
                  src={src}
                  alt={`${chapter.title} 第 ${i + 1} 页`}
                  loading={i < 2 ? 'eager' : 'lazy'}
                />
              )}
              <figcaption>
                {i + 1} / {pages.length}
              </figcaption>
            </figure>
          );
        })}
        <nav className="chapter-nav">
          {prev ? <a href={link(prev)}>← {prev.title}</a> : <span>第一章</span>}
          {next ? (
            <a href={link(next)}>{next.title} →</a>
          ) : (
            <a href={`/manga/${manga.slug}`}>返回目录 →</a>
          )}
        </nav>
      </main>
      <aside className="tools" aria-label="阅读工具">
        <button data-action="catalog" onClick={() => state.action('catalog')}>
          ☷<small>目录</small>
        </button>
        <button
          data-action="mode"
          onClick={() => state.action('mode')}
          className={state.settings.mode !== 'scroll' ? 'active' : ''}
        >
          ▣<small>翻页</small>
        </button>
        <button data-action="theme" onClick={() => state.action('theme')}>
          ◐<small>夜间</small>
        </button>
        <button data-action="settings" onClick={() => state.action('settings')}>
          <b>Aa</b>
          <small>设置</small>
        </button>
        <button data-action="fullscreen" onClick={() => state.action('fullscreen')}>
          ⛶<small>全屏</small>
        </button>
        <button data-action="top" onClick={() => state.action('top')}>
          ↑<small>顶部</small>
        </button>
      </aside>
      <button className="trigger" data-controls="" onClick={() => state.setControls(true)}>
        •••
      </button>
      <section className="mobile" data-mobile="">
        <button data-action="catalog" onClick={() => state.action('catalog')}>
          ☷<small>目录</small>
        </button>
        <button data-action="previous" onClick={() => state.action('previous')}>
          ←<small>上一页</small>
        </button>
        <button className="primary" data-action="next" onClick={() => state.action('next')}>
          →<small>下一页</small>
        </button>
        <button data-action="settings" onClick={() => state.action('settings')}>
          <b>Aa</b>
          <small>设置</small>
        </button>
      </section>
      <button
        className="scrim"
        data-scrim=""
        hidden={!state.catalog}
        onClick={() => state.setCatalog(false)}
      ></button>
      <aside className={`catalog${state.catalog ? ' open' : ''}`} data-catalog="">
        <header>
          <div>
            <small>{manga.title}</small>
            <h2>全部目录</h2>
          </div>
          <button data-close="" onClick={() => state.setCatalog(false)}>
            ×
          </button>
        </header>
        <nav>
          {navigation.map((x, i) => (
            <a key={x.id} className={x.id === chapter.id ? 'current' : ''} href={link(x)}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <b>{x.title}</b>
                <small>
                  {x.volume_title} · {x.page_count || 0} 页
                </small>
              </div>
              {x.id === chapter.id && <em>当前</em>}
            </a>
          ))}
        </nav>
      </aside>
      <dialog className="settings" data-settings="" ref={state.dialog}>
        <form method="dialog">
          <header>
            <h2>漫画阅读设置</h2>
            <button value="cancel">×</button>
          </header>
          <label>
            阅读方式
            <select
              data-setting="mode"
              value={state.settings.mode}
              onChange={(event) =>
                state.update({ mode: event.target.value as ReaderSettings['mode'] })
              }
            >
              <option value="scroll">连续滚动</option>
              <option value="paged">单页翻阅</option>
              <option value="double">双页阅读</option>
            </select>
          </label>
          <label>
            阅读方向
            <select
              data-setting="direction"
              value={state.settings.direction}
              onChange={(event) =>
                state.update({ direction: event.target.value as ReaderSettings['direction'] })
              }
            >
              <option value="ltr">从左到右</option>
              <option value="rtl">从右到左（日漫）</option>
            </select>
          </label>
          <label>
            页面宽度 <output data-width="">{state.settings.width}px</output>
            <input
              data-setting="width"
              value={state.settings.width}
              onChange={(event) => state.update({ width: Number(event.target.value) })}
              type="range"
              min="560"
              max="1400"
              step="40"
            />
          </label>
          <label>
            图片间距 <output data-gap="">{state.settings.gap}px</output>
            <input
              data-setting="gap"
              value={state.settings.gap}
              onChange={(event) => state.update({ gap: Number(event.target.value) })}
              type="range"
              min="0"
              max="40"
              step="4"
            />
          </label>
          <label>
            背景
            <div className="themes">
              <button
                type="button"
                data-theme="light"
                className={state.settings.theme === 'light' ? 'active' : ''}
                onClick={() => state.update({ theme: 'light' })}
              >
                浅色
              </button>
              <button
                type="button"
                data-theme="paper"
                className={state.settings.theme === 'paper' ? 'active' : ''}
                onClick={() => state.update({ theme: 'paper' })}
              >
                纸张
              </button>
              <button
                type="button"
                data-theme="night"
                className={state.settings.theme === 'night' ? 'active' : ''}
                onClick={() => state.update({ theme: 'night' })}
              >
                深色
              </button>
            </div>
          </label>
          <label className="toggle">
            显示页码
            <input
              data-setting="numbers"
              checked={state.settings.numbers}
              onChange={(event) => state.update({ numbers: event.target.checked })}
              type="checkbox"
            />
          </label>
        </form>
      </dialog>
      <div className="comic-toast" data-toast="" hidden={!state.toast}>
        {state.toast}
      </div>
    </div>
  );
}
