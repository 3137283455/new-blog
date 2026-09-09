'use client';

import { useRef } from 'react';
import { useMangaExperience } from '../use-manga-experience';
import { MangaSiteHeader, SearchIcon } from './site-header';
import { MangaSourcePicker } from './source-picker';
import { MangaResults } from './results';

export function MangaBrowsePage({
  mode,
  query = '',
  source = 'all',
}: {
  mode: 'search' | 'latest';
  query?: string;
  source?: string;
}) {
  const state = useMangaExperience(mode, query, source);
  const input = useRef<HTMLInputElement>(null);
  const isSearch = mode === 'search';
  return (
    <main
      className="manga-browse manga-redesign"
      data-manga-experience=""
      data-mode={mode}
      data-query={query}
      data-source={source}
    >
      <MangaSiteHeader active={isSearch ? 'discover' : 'latest'} backHref="/manga" />
      <div className="manga-browse-layout">
        <aside className="manga-context-rail manga-browse-context" aria-label="漫画浏览导航">
          <div className="manga-context-intro">
            <p>{isSearch ? 'SEARCH WORKSPACE' : 'LATEST WORKSPACE'}</p>
            <h2>{isSearch ? <>搜索<br />漫画</> : <>最新<br />发现</>}</h2>
            <span>{isSearch ? '在多个来源之间找到准确的作品入口。' : '把各个来源最新更新的作品收在这里。'}</span>
          </div>
          <nav className="manga-context-nav" aria-label="漫画站页面">
            <a href="/manga"><span>01</span>发现</a>
            <a className={!isSearch ? 'is-active' : undefined} href="/manga/latest"><span>02</span>最新</a>
            <a className={isSearch ? 'is-active' : undefined} href="/manga/search"><span>03</span>搜索</a>
            <a href="/manga/library"><span>04</span>书架</a>
          </nav>
          <section className="manga-context-status">
            <p>ACTIVE SOURCE</p>
            <strong>{state.sources.find((item) => item.id === state.selected)?.label || '全部来源'}</strong>
            <span>{state.sources.length} 个来源已连接</span>
          </section>
          <a className="manga-context-footer" href="/admin#manga-sources">
            <span>来源管理</span><small>打开后台 ↗</small>
          </a>
        </aside>
        <div className="manga-browse-content">
          <section className="manga-browse-head">
            <div>
              <p className="manga-eyebrow">
                {isSearch ? 'SEARCH THE SOURCES' : 'LATEST FROM THE SOURCES'}
              </p>
              <h1 data-search-title="">{state.title}</h1>
              <p>
                {isSearch
                  ? '从已启用的 Venera 兼容来源中检索作品，选择一个来源可以获得更准确的结果。'
                  : '选择一个支持发现页的来源，浏览它最近公开的作品。'}
              </p>
            </div>
            <div className="browse-head-actions">
              <MangaSourcePicker state={state} />
              <a className="browse-secondary" href={isSearch ? '/manga/latest' : '/manga/search'}>
                {isSearch ? '去看最新 →' : '搜索作品 →'}
              </a>
            </div>
          </section>
          {isSearch && (
        <form
          className="manga-browse-search"
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
          <input type="hidden" name="source" value={state.selected} />
          <label>
            <SearchIcon />
            <input
              ref={input}
              data-manga-query=""
              name="q"
              type="search"
              value={state.query}
              onChange={(event) => state.setQuery(event.target.value)}
              placeholder="输入漫画名、作者或关键词"
              autoComplete="off"
            />
            <kbd>Enter</kbd>
          </label>
          <button type="submit">
            搜索 <span>→</span>
          </button>
        </form>
          )}
          <section className="manga-browse-results">
            <header className="browse-results-head">
              <div>
                <p className="manga-eyebrow">{isSearch ? 'RESULTS' : 'SOURCE FEED'}</p>
                <h2>{isSearch ? '搜索结果' : '源站作品'}</h2>
              </div>
              <span data-manga-state="" className={state.error ? 'is-error' : ''}>
                {state.status}
              </span>
            </header>
            <div className="manga-result-grid" data-manga-results="" data-manga-explore="">
              <MangaResults state={state} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
