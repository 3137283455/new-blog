'use client';
import type { CSSProperties } from 'react';
import { MangaSiteHeader } from './site-header';
import { LibraryRemoteCard } from './library-remote-card';
import {
  useMangaLibrary,
  statusLabel,
  progressPercent,
  progressHref,
  type LibraryItem,
} from '../use-manga-library';

export function MangaLibraryPage({ initial }: { initial: LibraryItem[] }) {
  const library = useMangaLibrary(initial);
  const { manga } = library;
  const local = manga.filter((item) => item.library_type === 'local');
  const network = manga.filter((item) => item.library_type !== 'local');
  const statusCounts = {
    all: manga.length,
    reading: manga.filter((item) => (item.status || 'reading') === 'reading').length,
    finished: manga.filter((item) => item.status === 'finished').length,
    planned: manga.filter((item) => item.status === 'planned').length,
    paused: manga.filter((item) => item.status === 'paused').length,
  };
  const latestCover = manga.find((item) => item.id === library.latest?.id);
  return (
    <div className="manga-library-shell manga-redesign">
      <MangaSiteHeader active="library" backHref="/manga" />
      <section className="manga-collection-page" data-manga-library-refactor="">
        <header className="manga-intro">
          <div>
            <p className="eyebrow" data-manga-collection-eyebrow="">
              COMIC LIBRARY <span data-library-unscoped="">·</span>{' '}
              {manga.length ? 'PERSONAL COLLECTION' : 'READY TO BEGIN'}
            </p>
            <h1>漫画书架</h1>
            <p className="intro-description">
              本地作品和网络收藏放在同一个架子上，最近读过的章节永远近在手边。
            </p>
          </div>
          <div className="manga-stats" aria-label="漫画统计">
            <div>
              <strong data-manga-stat-total="">{manga.length}</strong>
              <span>全部</span>
            </div>
            <div>
              <strong data-manga-stat-local="">{local.length}</strong>
              <span>本地库</span>
            </div>
            <div>
              <strong data-manga-stat-network="">{network.length}</strong>
              <span>网络收藏</span>
            </div>
          </div>
        </header>

        <section className="manga-continue" data-manga-continue="" hidden={!library.latest}>
          <div className="continue-mark">
            <span>RECENTLY OPENED</span>
            <i>↗</i>
          </div>
          <div className="manga-continue-cover">
            <img
              data-manga-continue-cover=""
              src={latestCover?.cover || undefined}
              alt={latestCover?.cover ? `${latestCover.title}封面` : ''}
            />
          </div>
          <div className="manga-continue-copy">
            <p>LAST OPENED</p>
            <h2 data-manga-continue-title="">{library.latest?.title || '继续阅读'}</h2>
            <span data-manga-continue-chapter="">
              {library.latest
                ? `${library.latest.volume_title ? library.latest.volume_title + ' · ' : ''}${library.latest.chapter_title || '继续上次阅读'}`
                : '从上次停下的地方继续'}
            </span>
            <div className="manga-progress">
              <i
                data-manga-continue-bar=""
                style={
                  library.latest
                    ? { width: `${Math.max(1, progressPercent(library.latest))}%` }
                    : undefined
                }
              ></i>
            </div>
            <small data-manga-continue-progress="">
              {library.latest
                ? `本章第 ${Number(library.latest.page_index) + 1} / ${library.latest.page_count || 1} 页`
                : ''}
            </small>
          </div>
          <a
            className="continue-link"
            data-manga-continue-link=""
            href={progressHref(library.latest) || '/manga'}
          >
            打开漫画 <span>→</span>
          </a>
        </section>

        <div className="manga-library-layout">
          <section className="manga-collection-card">
            <header className="collection-head">
              <div>
                <p className="eyebrow">MY COMICS</p>
                <h2>我的漫画</h2>
              </div>
              <span data-manga-count="">{library.visible.length} 部</span>
            </header>
            <div className="manga-toolbar">
              <nav className="filter-tabs" aria-label="漫画库来源">
                <button
                  className={library.type === 'all' ? 'is-active' : ''}
                  onClick={() => library.setType('all')}
                  type="button"
                  data-manga-type="all"
                >
                  全部 <span>{statusCounts.all}</span>
                </button>
                <button
                  className={library.type === 'local' ? 'is-active' : ''}
                  onClick={() => library.setType('local')}
                  type="button"
                  data-manga-type="local"
                >
                  本地库 <span>{local.length}</span>
                </button>
                <button
                  className={library.type === 'network' ? 'is-active' : ''}
                  onClick={() => library.setType('network')}
                  type="button"
                  data-manga-type="network"
                >
                  网络收藏 <span>{network.length}</span>
                </button>
              </nav>
              <div className="toolbar-controls">
                <label className="manga-search">
                  <span>⌕</span>
                  <input
                    type="search"
                    data-manga-search=""
                    ref={library.searchRef}
                    value={library.query}
                    onChange={(event) => library.setQuery(event.target.value)}
                    placeholder="搜索漫画、作者"
                    autoComplete="off"
                  />
                  <kbd>/</kbd>
                </label>
                <select
                  data-manga-status=""
                  value={library.status}
                  onChange={(event) => library.setStatus(event.target.value)}
                  aria-label="漫画状态"
                >
                  <option value="all">全部状态</option>
                  <option value="reading">在读</option>
                  <option value="planned">想读</option>
                  <option value="finished">读完</option>
                  <option value="paused">暂放</option>
                </select>
                <select
                  data-manga-sort=""
                  value={library.sort}
                  onChange={(event) => library.setSort(event.target.value)}
                  aria-label="漫画排序"
                >
                  <option value="updated">最近整理</option>
                  <option value="title">标题</option>
                  <option value="chapters">章节数</option>
                </select>
                <button
                  className="random-manga"
                  type="button"
                  data-manga-random=""
                  onClick={library.random}
                >
                  随机一本
                </button>
                <div className="view-switch" aria-label="视图切换">
                  <button
                    type="button"
                    data-manga-view="grid"
                    className={library.view === 'grid' ? 'is-active' : ''}
                    onClick={() => library.selectView('grid')}
                    aria-label="封面网格"
                  >
                    ▦
                  </button>
                  <button
                    type="button"
                    data-manga-view="list"
                    className={library.view === 'list' ? 'is-active' : ''}
                    onClick={() => library.selectView('list')}
                    aria-label="列表视图"
                  >
                    ☷
                  </button>
                </div>
              </div>
            </div>
            <div className="collection-meta">
              <span>本地漫画支持分卷目录，网络收藏保留阅读源</span>
              <small data-manga-filter-summary="">{library.filterSummary}</small>
            </div>
            <div className="manga-shelf" data-manga-shelf="" data-view={library.view}>
              {library.ordered.map((item) => {
                if (item.collection)
                  return (
                    <LibraryRemoteCard
                      key={String(item.id)}
                      item={item}
                      href={library.itemHref(item)}
                      hidden={!library.matches(item)}
                    />
                  );
                const state = library.progress.find((entry) => entry.id === item.id);
                const percent = progressPercent(state);
                const continueHref = progressHref(state);

                const isLocal = item.library_type === 'local';
                return (
                  <article
                    key={String(item.id)}
                    hidden={!library.matches(item)}
                    className="manga-tile"
                    data-manga-card=""
                    data-id={item.id}
                    data-type={isLocal ? 'local' : 'network'}
                    data-status={item.status || 'reading'}
                    data-title={(item.title || '').toLocaleLowerCase()}
                    data-search={(
                      item.title +
                      ' ' +
                      (item.original_title || '') +
                      ' ' +
                      (item.author || '')
                    ).toLocaleLowerCase()}
                    data-updated={item.updated_at || ''}
                    data-chapters={item.chapter_count || 0}
                    data-progress={percent}
                  >
                    <a className="manga-tile-cover" href={`/manga/${item.slug}`}>
                      <span className="cover-index">
                        {String(item.sort_order || 1).padStart(2, '0')}
                      </span>
                      {item.cover ? (
                        <img
                          src={item.cover}
                          alt={`${item.title}封面`}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="cover-fallback">{item.title.slice(0, 1)}</span>
                      )}
                      <b>{isLocal ? '本地库' : '网络收藏'}</b>
                      <i className="cover-glow"></i>
                    </a>
                    <div className="manga-tile-copy">
                      <small>
                        {item.author || item.publication || (isLocal ? '本地作品' : '网络来源')}
                      </small>
                      <h3>
                        <a href={`/manga/${item.slug}`}>{item.title}</a>
                      </h3>
                      <p>
                        {item.description ||
                          (isLocal
                            ? `${item.volume_count || 0} 卷 · ${item.chapter_count || 0} 章`
                            : `${(item.read_sources || []).length} 个阅读源`)}
                      </p>
                      <div className="manga-card-progress" data-manga-progress="" hidden={!state}>
                        <i style={{ width: `${Math.max(1, percent)}%` }}></i>
                        <span>{`本章 ${percent}%`}</span>
                      </div>
                      <footer>
                        <span>
                          {isLocal
                            ? `${item.volume_count || 0} 卷 · ${item.chapter_count || 0} 章`
                            : statusLabel(item.status)}
                        </span>
                        <a data-manga-action="" href={continueHref || `/manga/${item.slug}`}>
                          {continueHref ? '继续阅读 →' : isLocal ? '查看目录 →' : '选择阅读源 →'}
                        </a>
                      </footer>
                    </div>
                  </article>
                );
              })}
            </div>
            <div
              className="manga-empty"
              data-manga-empty=""
              hidden={library.visible.length > 0 || manga.length === 0}
            >
              <strong>这里暂时没有漫画</strong>
              <span data-manga-empty-copy="">{library.emptyCopy}</span>
            </div>
            {!manga.length && (
              <div className="manga-empty is-empty" data-manga-library-empty="">
                <strong>漫画书架还是空的</strong>
                <span>前台搜索负责发现，打开漫画详情后即可加入书架或收藏。</span>
                <a href="/manga/search">去搜索漫画 →</a>
              </div>
            )}
          </section>

          <aside className="manga-rail">
            <section className="rail-card">
              <header>
                <p className="eyebrow">LIBRARY MIX</p>
                <span>收藏构成</span>
              </header>
              <div className="mix-meter">
                <i
                  data-manga-mix-meter=""
                  style={
                    {
                      '--mix': `${manga.length ? Math.round((local.length / manga.length) * 100) : 0}%`,
                    } as CSSProperties
                  }
                ></i>
              </div>
              <div className="mix-labels">
                <span>
                  <b data-manga-mix-local="">{local.length}</b> 本地漫画
                </span>
                <span>
                  <b data-manga-mix-network="">{network.length}</b> 网络收藏
                </span>
              </div>
            </section>
            <section className="rail-card manga-status-card">
              <header>
                <p className="eyebrow">READING STATUS</p>
                <span>当前状态</span>
              </header>
              <div className="status-list">
                <button
                  type="button"
                  data-manga-status-filter="reading"
                  onClick={() => library.setStatus('reading')}
                >
                  <i className="status-dot is-reading"></i>
                  <span>正在阅读</span>
                  <strong>{statusCounts.reading}</strong>
                  <b>→</b>
                </button>
                <button
                  type="button"
                  data-manga-status-filter="planned"
                  onClick={() => library.setStatus('planned')}
                >
                  <i className="status-dot is-planned"></i>
                  <span>准备阅读</span>
                  <strong>{statusCounts.planned}</strong>
                  <b>→</b>
                </button>
                <button
                  type="button"
                  data-manga-status-filter="finished"
                  onClick={() => library.setStatus('finished')}
                >
                  <i className="status-dot is-finished"></i>
                  <span>已经读完</span>
                  <strong>{statusCounts.finished}</strong>
                  <b>→</b>
                </button>
              </div>
            </section>
            <a className="rail-link" href="/reading">
              <span>阅读中心</span>
              <small>查看小说与漫画记录 ↗</small>
            </a>
          </aside>
        </div>
      </section>
    </div>
  );
}
