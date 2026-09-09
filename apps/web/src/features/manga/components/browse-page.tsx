'use client';

import { useRef } from 'react';
import { useMangaExperience } from '../use-manga-experience';
import { SearchIcon } from './site-header';
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
      <div className="manga-browse-layout">
        <aside className="manga-context-rail manga-browse-context" aria-label="漫画浏览导航">
          <nav className="manga-context-nav" aria-label="漫画站页面">
            <a href="/manga">
              <span>01</span>发现
            </a>
            <a className={!isSearch ? 'is-active' : undefined} href="/manga/latest">
              <span>02</span>最新
            </a>
            <a className={isSearch ? 'is-active' : undefined} href="/manga/search">
              <span>03</span>搜索
            </a>
            <a href="/manga/library">
              <span>04</span>书架
            </a>
          </nav>
          <section className="manga-context-status">
            <p>当前来源</p>
            <strong>
              {state.sources.find((item) => item.id === state.selected)?.label || '全部来源'}
            </strong>
            <span>{state.sources.length} 个来源已连接</span>
          </section>
          <a className="manga-context-footer" href="/admin#manga-sources">
            <span>来源管理</span>
            <small>打开后台 ↗</small>
          </a>
        </aside>
        <div className="manga-browse-content">
          <section className="manga-browse-head">
            <div>
              <h1 data-search-title="">{state.title}</h1>
              <p>{isSearch ? '搜索喜欢的作品，也可以切换来源。' : '看看最近更新了哪些漫画。'}</p>
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
