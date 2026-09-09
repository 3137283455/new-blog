'use client';

import { useEffect, useRef } from 'react';
import type { MangaShelfItem } from '../contracts';
import { useMangaExperience } from '../use-manga-experience';
import { MangaSiteHeader, SearchIcon } from './site-header';
import { MangaSourcePicker } from './source-picker';
import { MangaResults } from './results';

export function MangaHomePage({ manga }: { manga: MangaShelfItem[] }) {
  const state = useMangaExperience('home');
  const input = useRef<HTMLInputElement>(null);
  const local = manga.filter((item) => item.library_type === 'local');
  const network = manga.filter((item) => item.library_type !== 'local');
  // Preserve the old /manga?source=... selection without moving search results onto the homepage.
  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get('source');
    if (source) state.setSelected(source);
  }, [state.setSelected]);

  return (
    <main className="manga-home manga-redesign" data-manga-experience="" data-mode="home">
      <MangaSiteHeader active="discover" />
      <div className="manga-home-layout">
        <aside className="manga-context-rail manga-home-context" aria-label="漫画站导航">
          <nav className="manga-context-nav" aria-label="漫画站页面">
            <a className="is-active" href="/manga">
              <span>01</span>发现
            </a>
            <a href="/manga/latest">
              <span>02</span>最新
            </a>
            <a href="/manga/rank">
              <span>03</span>排行
            </a>
            <a href="/manga/library">
              <span>04</span>书架
            </a>
          </nav>
          <section className="manga-context-stats">
            <p>COLLECTION</p>
            <div>
              <strong>{manga.length}</strong>
              <span>部收藏</span>
            </div>
            <div>
              <strong>{local.length}</strong>
              <span>本地作品</span>
            </div>
            <div>
              <strong>{network.length}</strong>
              <span>网络来源</span>
            </div>
          </section>
          <a className="manga-context-footer" href="/reading">
            <span>阅读记录</span>
            <small>打开阅读中心 ↗</small>
          </a>
        </aside>
        <div className="manga-home-stage">
          <section className="manga-simple-search">
            <div className="manga-simple-search-copy">
              <p className="manga-eyebrow">DISCOVER · SEARCH · READ</p>
              <h1>找点漫画</h1>
              <p>从已启用的来源中搜索作品，打开详情、章节和阅读。</p>
            </div>
          <form
            className="manga-search-bar"
            data-manga-search-form=""
            action="/manga/search"
            method="get"
            onSubmit={(event) => {
              event.preventDefault();
              const submitted = String(new FormData(event.currentTarget).get('q') || '');
              if (!submitted.trim()) input.current?.focus();
              void state.search(submitted, state.selected);
            }}
          >
            <label>
              <SearchIcon />
              <input
                ref={input}
                data-manga-query=""
                name="q"
                type="search"
                placeholder="搜索漫画、作者或关键词"
                autoComplete="off"
                value={state.query}
                onChange={(event) => state.setQuery(event.target.value)}
              />
            </label>
            <MangaSourcePicker state={state} />
            <input type="hidden" name="source" value={state.selected} />
            <button type="submit">
              开始搜索 <span>→</span>
            </button>
          </form>
          <p
            className={`manga-inline-state${state.error ? ' is-error' : ''}`}
            data-manga-state=""
            data-source-status=""
          >
            {state.status}
          </p>
          </section>
          <section className="manga-shortcuts" aria-label="漫画站快捷入口">
            <a href="/manga/latest">
              <span className="shortcut-icon">↗</span>
              <span>
                <small>KEEP EXPLORING</small>
                <strong>最新发现</strong>
              </span>
              <b>打开 →</b>
            </a>
            <a href="/manga/library">
              <span className="shortcut-icon">▦</span>
              <span>
                <small>YOUR COLLECTION</small>
                <strong>我的书架</strong>
              </span>
              <b>{manga.length} 部 →</b>
            </a>
            <a href="/admin#manga-sources">
              <span className="shortcut-icon">◈</span>
              <span>
                <small>SOURCE CONTROL</small>
                <strong>管理漫画源</strong>
              </span>
              <b>后台 →</b>
            </a>
          </section>
          <section className="manga-home-results">
            <header className="manga-section-head">
              <div>
                <p className="manga-eyebrow">SOURCE DISCOVERY</p>
                <h2>发现作品</h2>
              </div>
              <span data-explore-source="">{state.exploreLabel}</span>
            </header>
            <div className="manga-result-grid" data-manga-explore="">
              <MangaResults state={state} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
