'use client';
import { useEffect, useRef } from 'react';
import type { MangaShelfItem } from '../contracts';
import { useMangaExperience } from '../use-manga-experience';
import { SearchIcon } from './site-header';
import { MangaSourcePicker } from './source-picker';
import { MangaResults } from './results';
import '../styles/MangaDiscovery.css';

export function MangaHomePage({ manga }: { manga: MangaShelfItem[] }) {
  const state = useMangaExperience('home');
  const input = useRef<HTMLInputElement>(null);
  const localCount = manga.filter((item) => item.library_type === 'local').length;
  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get('source');
    if (source) state.setSelected(source);
  }, [state.setSelected]);
  const unavailable = state.sourceError || state.error;
  return (
    <div className="manga-discovery" data-manga-experience="" data-mode="home">
      <aside className="discovery-sidebar" aria-label="漫画站导航">
        <nav aria-label="漫画站页面">
          {[
            ['/manga', '发现'],
            ['/manga/latest', '最新'],
            ['/manga/rank', '排行'],
            ['/manga/library', '书架'],
          ].map(([href, label], index) => (
            <a key={href} href={href} aria-current={index === 0 ? 'page' : undefined}>
              <span>0{index + 1}</span>
              {label}
            </a>
          ))}
        </nav>
        <section aria-label="收藏统计">
          <h2>我的收藏</h2>
          <dl>
            <div>
              <dt>全部漫画</dt>
              <dd>{manga.length}</dd>
            </div>
            <div>
              <dt>本地作品</dt>
              <dd>{localCount}</dd>
            </div>
            <div>
              <dt>网络收藏</dt>
              <dd>{manga.length - localCount}</dd>
            </div>
          </dl>
        </section>
        <a className="discovery-utility" href="/reading">
          阅读记录 <span>↗</span>
        </a>
        <a className="discovery-utility" href="/admin#manga-sources">
          管理来源 <span>↗</span>
        </a>
      </aside>
      <section className="discovery-content" aria-labelledby="discovery-title">
        <header className="discovery-heading">
          <div>
            <h1 id="discovery-title">漫画</h1>
            <p>找一本喜欢的，慢慢读。</p>
          </div>
          <a href="/manga/library">我的书架 ↗</a>
        </header>
        <form
          className="discovery-search"
          action="/manga/search"
          method="get"
          data-manga-search-form=""
          onSubmit={(event) => {
            event.preventDefault();
            if (!state.query.trim()) {
              input.current?.focus();
              return;
            }
            void state.search(state.query, state.selected);
          }}
        >
          <label>
            <SearchIcon />
            <input
              ref={input}
              name="q"
              type="search"
              aria-label="搜索漫画"
              data-manga-query=""
              placeholder="搜索漫画、作者或关键词"
              autoComplete="off"
              value={state.query}
              onChange={(event) => state.setQuery(event.target.value)}
            />
          </label>
          <MangaSourcePicker state={state} />
          <input type="hidden" name="source" value={state.selected} />
          <button className="discovery-submit" type="submit">
            搜索
          </button>
        </form>
        {state.items.length > 0 ? (
          <section aria-label="发现漫画">
            <div className="discovery-result-caption">
              <span data-explore-source="">{state.exploreLabel}</span>
              <a href="/manga/latest">查看全部 →</a>
            </div>
            <div className="manga-result-grid" data-manga-explore="">
              <MangaResults state={state} />
            </div>
          </section>
        ) : (
          <div
            className="discovery-empty"
            role="status"
            aria-live="polite"
            data-manga-state=""
            data-source-status=""
          >
            <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <path d="M24 13c-5-4-12-4-18-2v26c6-2 13-2 18 2 5-4 12-4 18-2V11c-6-2-13-2-18 2Zm0 0v26M12 18h6m-6 6h6m12-6h6m-6 6h6" />
            </svg>
            <h2>
              {unavailable
                ? '暂时无法加载漫画'
                : state.sourcesReady
                  ? state.empty[0]
                  : '正在加载漫画'}
            </h2>
            <p>
              {unavailable
                ? '可以切换漫画来源，或稍后再试。'
                : state.sourcesReady
                  ? state.empty[1]
                  : '稍等片刻，故事就来。'}
            </p>
            {unavailable && (
              <button type="button" onClick={() => window.location.reload()}>
                重新加载
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
