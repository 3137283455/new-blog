'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RequestLane } from '../../shared/http/json';
import { mangaApi } from './api';
import type { BrowseMode, MangaSearchItem, MangaSource } from './contracts';

const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function useMangaExperience(mode: BrowseMode, initialQuery = '', initialSource = 'all') {
  const [sources, setSources] = useState<MangaSource[]>([]);
  const [sourcesReady, setSourcesReady] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  const [selected, setSelected] = useState(initialSource);
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<MangaSearchItem[]>([]);
  const [initialPlaceholder, setInitialPlaceholder] = useState(true);
  const [title, setTitle] = useState(mode === 'search' ? '搜索漫画' : '最新发现');
  const [status, setStatus] = useState(mode === 'home' ? '正在读取漫画源…' : '正在准备漫画源…');
  const [error, setError] = useState(false);
  const [exploreLabel, setExploreLabel] = useState('正在选择来源…');
  const [empty, setEmpty] = useState(
    mode === 'search'
      ? ['输入关键词开始搜索', '结果会在这里展示。']
      : [
          '正在读取漫画源',
          mode === 'home'
            ? '首次打开会从支持发现页的来源加载作品。'
            : '首次打开会从选中的来源获取内容。',
        ],
  );
  const lane = useRef(new RequestLane());
  const initialSearch = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    mangaApi
      .sources(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const available = data.sources || [];
        setSources(available);
        setSelected((current) =>
          current === 'all' || available.some((source) => source.id === current) ? current : 'all',
        );
        setSourcesReady(true);
        if (mode === 'home')
          setStatus(available.length ? '源已就绪，可直接搜索' : '暂无漫画源，请先导入源仓库');
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setSourceError(true);
        setStatus(message(cause, '漫画源读取失败'));
        setError(true);
      });
    return () => controller.abort();
  }, [mode]);

  useEffect(() => {
    const current = lane.current;
    return () => current.cancel();
  }, []);

  const search = useCallback(
    async (value: string, source: string) => {
      if (!value.trim()) {
        setStatus('请输入漫画名称或关键词');
        setError(true);
        return;
      }
      if (mode !== 'search') {
        window.location.assign(
          `/manga/search?q=${encodeURIComponent(value.trim())}&source=${encodeURIComponent(source)}`,
        );
        return;
      }
      const request = lane.current.begin();
      setInitialPlaceholder(false);
      setItems([]);
      setEmpty(['正在搜索', '正在请求已启用的漫画源…']);
      setStatus('正在检索漫画源…');
      setError(false);
      try {
        const data = await mangaApi.search(source, value.trim(), request.signal);
        if (!request.isCurrent()) return;
        const results = data.items || [];
        setItems(results);
        setEmpty(['没有找到漫画', '换一个关键词或来源试试。']);
        setTitle(`“${value.trim()}”的搜索结果`);
        setStatus(
          `${results.length} 个结果${data.aggregate ? ` · ${(data.sources || []).filter((item) => item.ok).length} 个来源响应` : ` · ${data.source?.label || '漫画源'}`}`,
        );
        const next = new URL(window.location.href);
        next.searchParams.set('q', value.trim());
        next.searchParams.set('source', source);
        window.history.replaceState(window.history.state, '', next);
      } catch (cause) {
        if (!request.isCurrent()) return;
        const text = message(cause, '漫画源搜索失败');
        setEmpty(['搜索失败', text]);
        setStatus(text);
        setError(true);
      }
    },
    [mode],
  );

  useEffect(() => {
    if (!sourcesReady || mode !== 'search' || initialSearch.current) return;
    initialSearch.current = true;
    if (initialQuery.trim()) void search(initialQuery, selected);
  }, [sourcesReady, mode, initialQuery, selected, search]);

  useEffect(() => {
    if (!sourcesReady || mode === 'search') return;
    const request = lane.current.begin();
    setInitialPlaceholder(false);
    const source =
      selected === 'all'
        ? sources.find((item) => item.has_explore)
        : sources.find((item) => item.id === selected);
    setItems([]);
    setError(false);
    if (!source?.has_explore) {
      setEmpty(['从搜索开始', '选择一个支持发现页的来源，或使用顶部搜索找到漫画。']);
      setStatus('选择来源后即可发现漫画');
      return () => lane.current.cancel();
    }
    setEmpty(['正在读取', `正在从 ${source.label} 获取作品…`]);
    mangaApi
      .explore(source.id, request.signal)
      .then((data) => {
        if (!request.isCurrent()) return;
        const results = data.items || [];
        setItems(results);
        setEmpty(['暂无作品', '这个来源暂时没有返回发现内容。']);
        setExploreLabel(`${source.label} · ${results.length} 部作品`);
        setStatus(`${source.label} 已返回 ${results.length} 部作品`);
      })
      .catch((cause) => {
        if (!request.isCurrent()) return;
        const text = message(cause, '发现页读取失败');
        setEmpty(['发现页暂不可用', text]);
        setStatus(text);
        setError(true);
      });
    return () => lane.current.cancel();
  }, [sourcesReady, sources, selected, mode]);

  return {
    sources,
    sourcesReady,
    sourceError,
    selected,
    setSelected,
    query,
    setQuery,
    items,
    title,
    status,
    error,
    empty,
    initialPlaceholder,
    exploreLabel,
    search,
  };
}

export type MangaExperience = ReturnType<typeof useMangaExperience>;
