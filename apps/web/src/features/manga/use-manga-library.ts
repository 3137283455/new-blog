'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ensurePrivateDeviceToken } from '../../shared/device/private-device';
import {
  collectionKey,
  getPrivateMangaCollections,
  mergeMangaCollections,
  readLocalMangaCollections,
  type MangaCollection,
} from './collections';

export interface LibraryItem {
  id: number | string;
  slug: string;
  title: string;
  original_title?: string;
  cover?: string;
  author?: string;
  publication?: string;
  description?: string;
  library_type?: string;
  status?: string;
  updated_at?: string;
  chapter_count?: number;
  volume_count?: number;
  sort_order?: number;
  read_sources?: unknown[];
  collection?: MangaCollection;
}
export interface MangaProgress {
  id: number;
  slug: string;
  title: string;
  volume_slug?: string;
  chapter_slug?: string;
  volume_title?: string;
  chapter_title?: string;
  page_index?: number;
  page_count?: number;
}
export const progressPercent = (state?: MangaProgress) =>
  Math.round(
    Math.max(
      0,
      Math.min(1, (Number(state?.page_index) || 0) / Math.max(1, Number(state?.page_count) || 1)),
    ) * 100,
  );
export const progressHref = (state?: MangaProgress) =>
  state?.volume_slug && state.chapter_slug
    ? `/manga/${encodeURIComponent(state.slug)}/${encodeURIComponent(state.volume_slug)}/${encodeURIComponent(state.chapter_slug)}?page=${Math.max(1, Number(state.page_index) + 1)}`
    : undefined;
export const statusLabel = (status?: string) =>
  ({ reading: '在读', finished: '读完', planned: '想读', paused: '暂放' })[status || 'reading'] ||
  '在读';

export function useMangaLibrary(initial: LibraryItem[]) {
  const [collections, setCollections] = useState<MangaCollection[]>([]);
  const [progress, setProgress] = useState<MangaProgress[]>([]);
  const [type, setType] = useState('all'),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState('all'),
    [sort, setSort] = useState('updated'),
    [view, setView] = useState('grid');
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    try {
      setView(localStorage.getItem('boke_manga_view') === 'list' ? 'list' : 'grid');
    } catch {}
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', keyboard);
    void (async () => {
      const local = readLocalMangaCollections();
      setCollections(local);
      const token = await ensurePrivateDeviceToken('/api');
      if (disposed || !token) return;
      try {
        const remote = await getPrivateMangaCollections('/api', token);
        if (!disposed) setCollections(mergeMangaCollections(local, remote));
      } catch {}
      try {
        const response = await fetch('/api/private/manga', {
          headers: { 'X-Device-Token': token },
          signal: controller.signal,
        });
        const body = await response.json();
        if (!disposed && response.ok && Array.isArray(body.data)) setProgress(body.data);
      } catch {}
    })();
    return () => {
      disposed = true;
      controller.abort();
      window.removeEventListener('keydown', keyboard);
    };
  }, []);
  const manga = useMemo<LibraryItem[]>(
    () => [
      ...initial,
      ...collections.map((item) => ({
        ...item,
        id: `remote-${collectionKey(item.source, item.external_id)}`,
        slug: '',
        library_type: 'network',
        status: item.status || 'planned',
        collection: item,
      })),
    ],
    [initial, collections],
  );
  const matches = (item: LibraryItem) => {
    const search =
      `${item.title || ''} ${item.original_title || ''} ${item.author || ''}`.toLocaleLowerCase();
    return (
      (type === 'all' || (item.library_type === 'local' ? 'local' : 'network') === type) &&
      (status === 'all' || (item.status || 'reading') === status) &&
      (!query.trim() || search.includes(query.trim().toLocaleLowerCase()))
    );
  };
  const ordered = [...manga].sort((a, b) =>
    sort === 'title'
      ? a.title.toLocaleLowerCase().localeCompare(b.title.toLocaleLowerCase(), 'zh-CN')
      : sort === 'chapters'
        ? Number(b.chapter_count || 0) - Number(a.chapter_count || 0)
        : (b.updated_at || '').localeCompare(a.updated_at || ''),
  );
  const visible = ordered.filter(matches);
  const selectView = (value: string) => {
    setView(value);
    try {
      localStorage.setItem('boke_manga_view', value);
    } catch {}
  };
  const itemHref = (item: LibraryItem) =>
    item.collection
      ? `/source/manga/${encodeURIComponent(item.collection.source)}/${encodeURIComponent(item.collection.external_id)}`
      : `/manga/${item.slug}`;
  const random = () => {
    const item = visible[Math.floor(Math.random() * visible.length)];
    if (item) location.href = itemHref(item);
  };
  const typeLabel = { all: '全部漫画', local: '本地漫画', network: '网络收藏' }[type] || '全部漫画';
  const filterSummary = status === 'all' ? typeLabel : `${typeLabel} · ${statusLabel(status)}`;
  const emptyCopy = query.trim()
    ? '没有匹配当前筛选条件的漫画。'
    : type === 'local'
      ? '从后台导入 CBZ、ZIP 或图片型 EPUB。'
      : type === 'network'
        ? '在前台漫画详情页点击加入书架或收藏。'
        : '换一个状态或关键词试试。';
  return {
    manga,
    ordered,
    visible,
    matches,
    type,
    setType,
    query,
    setQuery,
    status,
    setStatus,
    sort,
    setSort,
    view,
    selectView,
    searchRef,
    random,
    filterSummary,
    emptyCopy,
    progress,
    latest: progress[0],
    itemHref,
  };
}
