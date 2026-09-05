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
      className="manga-browse"
      data-manga-experience=""
      data-mode={mode}
      data-query={query}
      data-source={source}
    >
      <MangaSiteHeader active={isSearch ? 'discover' : 'latest'} />
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
          onSubmit={(event) => {
            event.preventDefault();
            if (!state.query.trim()) input.current?.focus();
            void state.search(state.query, state.selected);
          }}
        >
          <label>
            <SearchIcon />
            <input
              ref={input}
              data-manga-query=""
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
    </main>
  );
}
