'use client';

import { useRef, useState } from 'react';
import type { MangaExperience } from '../use-manga-experience';
import { SearchIcon } from './site-header';

export function MangaSourcePicker({ state }: { state: MangaExperience }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState('');
  const { sources, selected, setSelected } = state;
  const visible = sources.filter((source) =>
    `${source.label} ${source.id}`.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
  );
  const label =
    selected === 'all'
      ? '全部来源'
      : sources.find((source) => source.id === selected)?.label || selected;
  const select = (id: string) => {
    setSelected(id);
    dialog.current?.close();
  };

  return (
    <div className="manga-source-picker" data-manga-source-picker="">
      <input type="hidden" data-manga-selected-source="" value={selected} />
      <button
        className="manga-source-trigger"
        type="button"
        data-manga-source-open=""
        aria-haspopup="dialog"
        onClick={() => {
          setFilter('');
          dialog.current?.showModal();
        }}
      >
        <span className="source-trigger-mark">◈</span>
        <span>
          <small>漫画来源</small>
          <strong data-manga-selected-source-label="">{label}</strong>
        </span>
        <b>⌄</b>
      </button>
      <dialog
        ref={dialog}
        className="manga-source-dialog"
        data-manga-source-dialog=""
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="manga-source-dialog-panel">
          <header>
            <div>
              <p>CONTENT SOURCES</p>
              <h2>选择漫画来源</h2>
              <span data-manga-source-summary="">
                {state.sourceError
                  ? '漫画源暂时不可用'
                  : state.sourcesReady
                    ? `${sources.length} 个来源可用于前台搜索与阅读`
                    : '正在读取已启用来源…'}
              </span>
            </div>
            <button
              className="manga-dialog-close"
              type="button"
              data-manga-source-close=""
              aria-label="关闭"
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </header>
          <label className="manga-source-search">
            <SearchIcon />
            <input
              type="search"
              data-manga-source-filter=""
              placeholder="搜索来源名称"
              autoComplete="off"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>
          <div className="manga-source-list" data-manga-source-list="">
            <button
              className={`manga-source-item ${selected === 'all' ? 'active' : ''}`}
              type="button"
              data-source-option="all"
              onClick={() => select('all')}
            >
              <i>ALL</i>
              <span>
                <strong>全部漫画源</strong>
                <small>聚合搜索 · {sources.length} 个已启用来源</small>
              </span>
              <b>{selected === 'all' ? '✓' : ''}</b>
            </button>
            {visible.map((source) => (
              <button
                key={source.id}
                className={`manga-source-item ${selected === source.id ? 'active' : ''}`}
                type="button"
                data-source-option={source.id}
                onClick={() => select(source.id)}
              >
                <i>{String(source.label || '源').slice(0, 1)}</i>
                <span>
                  <strong>{source.label}</strong>
                  <small>
                    {source.has_reader ? '可站内阅读' : '源站详情'}
                    {source.has_explore ? ' · 支持发现' : ''}
                  </small>
                </span>
                <b>{selected === source.id ? '✓' : ''}</b>
              </button>
            ))}
          </div>
          <footer>
            <span>来源由 Venera 兼容源仓库提供</span>
            <a href="/admin#manga-sources">管理来源 ↗</a>
          </footer>
        </div>
      </dialog>
    </div>
  );
}
