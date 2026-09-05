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
    <main className="manga-home" data-manga-experience="" data-mode="home">
      <MangaSiteHeader active="discover" />
      <section className="manga-home-hero">
        <div className="manga-home-hero-copy">
          <p className="manga-eyebrow">DISCOVER · SEARCH · READ</p>
          <h1>
            在前台找到
            <br />
            <em>下一部漫画。</em>
          </h1>
          <p>
            从已导入的 Venera
            兼容源中搜索作品，打开详情、章节和阅读。这里负责发现，后台只负责维护来源。
          </p>
          <form
            className="manga-search-bar"
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
                placeholder="搜索漫画、作者或关键词"
                autoComplete="off"
                value={state.query}
                onChange={(event) => state.setQuery(event.target.value)}
              />
            </label>
            <MangaSourcePicker state={state} />
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
        </div>
        <div className="manga-hero-art" aria-hidden="true">
          <div className="hero-orbit hero-orbit-one" />
          <div className="hero-orbit hero-orbit-two" />
          <div className="hero-orbit hero-orbit-three" />
          <span>漫</span>
        </div>
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
      <div className="manga-home-grid">
        <section className="manga-home-main">
          <header className="manga-section-head">
            <div>
              <p className="manga-eyebrow">SOURCE DISCOVERY</p>
              <h2>源站发现</h2>
            </div>
            <span data-explore-source="">{state.exploreLabel}</span>
          </header>
          <div className="manga-result-grid" data-manga-explore="">
            <MangaResults state={state} />
          </div>
        </section>
        <aside className="manga-home-rail">
          <section className="manga-rail-card manga-library-preview">
            <header>
              <div>
                <p className="manga-eyebrow">MY SHELF</p>
                <h3>我的书架</h3>
              </div>
              <a href="/manga/library">查看全部 ↗</a>
            </header>
            <div className="manga-shelf-stats">
              <div>
                <strong>{manga.length}</strong>
                <span>全部</span>
              </div>
              <div>
                <strong>{local.length}</strong>
                <span>本地</span>
              </div>
              <div>
                <strong>{network.length}</strong>
                <span>网络</span>
              </div>
            </div>
            <div className="manga-preview-list">
              {manga.slice(0, 4).map((item) => (
                <a key={item.id} href={`/manga/${item.slug}`}>
                  <span className="preview-cover">
                    {item.cover ? (
                      <img src={item.cover} alt="" loading="lazy" />
                    ) : (
                      item.title.slice(0, 1)
                    )}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.author || (item.library_type === 'local' ? '本地漫画' : '网络收藏')}
                    </small>
                  </span>
                  <b>→</b>
                </a>
              ))}
              {!manga.length && <p>书架还是空的。搜索到喜欢的作品后再收藏。</p>}
            </div>
          </section>
          <section className="manga-rail-note">
            <span>TIP</span>
            <p>源选择藏在搜索框里，需要时打开即可，不会占据首页空间。</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
