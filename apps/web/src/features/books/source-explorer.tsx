'use client';

import { useEffect, useState } from 'react';
import type { MangaSource } from '../manga/contracts';

interface SourceItem {
  source?: string;
  external_id: string;
  source_label?: string;
  title: string;
  original_title?: string;
  author?: string;
  description?: string;
  cover?: string;
  total?: number;
}

export function ContentSourceExplorer({ kind }: { kind: 'book' | 'manga' | 'bangumi' }) {
  const label = kind === 'book' ? '小说' : kind === 'manga' ? '漫画' : '番剧';
  const [sources, setSources] = useState<MangaSource[]>([]);
  const [source, setSource] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SourceItem[]>([]);
  const [status, setStatus] = useState('正在读取已导入的源…');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/content-sources?kind=${encodeURIComponent(kind)}`, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || json.success === false) throw new Error(json.message || '源读取失败');
        setSources(json.data?.sources || []);
        setStatus(json.data?.sources?.length ? `已启用 ${json.data.sources.length} 个${label}源` : '暂无此类型的源，请先在后台导入');
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setStatus(error.message || '源读取失败');
      });
    return () => controller.abort();
  }, [kind, label]);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return setStatus('请输入搜索关键词');
    setBusy(true);
    setItems([]);
    setStatus('正在通过源站检索…');
    try {
      const params = new URLSearchParams({ kind, q: value });
      if (source) params.set('source', source);
      const response = await fetch(`/api/content-sources/search?${params}`);
      const json = await response.json();
      if (!response.ok || json.success === false) throw new Error(json.message || '源站检索失败');
      setItems(json.data?.items || []);
      setStatus(`来自 ${json.data?.source?.label || '源站'} · 找到 ${(json.data?.items || []).length} 条结果`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '源站检索失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="source-explorer" data-source-explorer="" data-kind={kind}>
      <header className="source-explorer-header"><div><small>SOURCE DISCOVERY</small><h2>从源中搜索{label}</h2><p>源只负责发现与阅读，书架只保存你的阅读状态。</p></div><span className="source-explorer-status">{status}</span></header>
      <form className="source-explorer-form" onSubmit={search} data-source-form=""><label className="source-explorer-input"><span aria-hidden="true">⌕</span><input data-source-query="" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${label}名称`} autoComplete="off" /><kbd>Enter</kbd></label><select data-source-select="" aria-label="选择内容源" value={source} onChange={(event) => setSource(event.target.value)}><option value="">默认源</option>{sources.map((item) => <option key={item.id} value={item.id}>{item.label}{item.has_reader ? ' · 可直接阅读' : ''}</option>)}</select><button type="submit" disabled={busy}>开始搜索 <span>→</span></button></form>
      <div className="source-explorer-results" data-source-results="" aria-live="polite">{items.length ? items.map((item) => <a className="source-result" key={`${item.source || source}:${item.external_id}`} href={`/source/${encodeURIComponent(kind)}/${encodeURIComponent(item.source || source)}/${encodeURIComponent(item.external_id)}`}><span>{item.cover ? <img src={item.cover} alt="" loading="lazy" /> : item.title.slice(0, 1)}</span><span><strong>{item.title}</strong><small>{item.author || item.original_title || item.source_label || ''}</small><p>{item.description || '打开查看详情与可读章节'}</p><em>{item.source_label || ''}{item.total ? ` · ${item.total} 章` : ''}</em></span></a>) : <p className="source-explorer-empty">导入源后，这里会显示来自源站的搜索结果。</p>}</div>
    </section>
  );
}
