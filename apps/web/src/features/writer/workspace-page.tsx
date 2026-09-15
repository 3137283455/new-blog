'use client';
import { useEffect, useState } from 'react';
import { writingRequest } from './writing-api';
import { WebImportDialog } from './web-import-dialog';
import { toast } from '../../shared/ui/toast';
type Article = { id: number; title: string; excerpt?: string; status: string; category_name?: string; updated_at?: string; view_count: number; is_pinned?: boolean };
const tabs = [['all','全部文章'],['draft','草稿'],['published','已发布'],['trash','回收站']];
export function WritingWorkspace() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({summary: 'true',pageSize: '20',page: String(page),q: query});
        if (tab === 'trash') params.set('trashed','true'); else if (tab !== 'all') params.set('status',tab);
        const json = await writingRequest('/admin/articles?' + params, {signal: controller.signal});
        setArticles(json.data); setTotal(json.pagination?.total || 0); setError('');
      } catch (error) { if (!controller.signal.aborted) setError((error as Error).message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [tab,query,page,revision]);
  async function action(article: Article, kind: string) {
    if (kind !== 'restore' && !confirm(kind === 'force' ? '永久删除“' + article.title + '”？此操作无法恢复。' : '将“' + article.title + '”移入回收站？')) return;
    setPending(article.id);
    try {
      await writingRequest('/admin/articles/' + article.id + (kind === 'restore' ? '/restore' : kind === 'force' ? '/force' : ''), {method: kind === 'restore' ? 'PUT' : 'DELETE'});
      toast.success(kind === 'restore' ? '文章已恢复' : kind === 'force' ? '文章已永久删除' : '文章已移入回收站');
      if (articles.length === 1 && page > 1) setPage(page - 1); else setRevision(revision + 1);
    } catch (error) { const message = (error as Error).message; setError(message); toast.error(message); }
    finally { setPending(null); }
  }
  return <main className="writing-workspace">
    <header className="writing-nav"><a href="/admin" className="writing-back">← 返回后台</a><span>内容中心 <i>/</i> 写作台</span><a href="/" target="_blank" rel="noopener">查看站点 ↗</a></header>
    <div className="writing-container"><header className="writing-heading"><div><span className="writing-eyebrow">YOUR WORDS, YOUR SPACE</span><h1>写作台<span>从一个想法，到一篇好文章。</span></h1></div><div className="writing-heading-actions"><button onClick={() => setImporting(true)}>↗ 网页导入</button><a className="writing-primary" href="/admin/write/editor">＋ 新建文章</a></div></header>
      <section className="writing-library" aria-label="文章管理"><div className="writing-library-tools"><nav aria-label="文章状态">{tabs.map(([value,label]) => <button key={value} aria-pressed={tab === value} className={tab === value ? 'active' : ''} onClick={() => {setTab(value);setPage(1);}}>{label}</button>)}</nav><input aria-label="搜索文章" type="search" value={query} placeholder="搜索标题、摘要…" onChange={event => {setQuery(event.target.value);setPage(1);}}/></div>
      {error && <div className="writing-error" role="alert">{error} <button onClick={() => setRevision(revision + 1)}>重试</button></div>}
      <div className="writing-list" aria-busy={loading}><div className="writing-list-head"><span>文章</span><span>状态 / 分类</span><span>最近修改</span><span>操作</span></div>
        {loading ? <p className="writing-empty" role="status">正在读取文章…</p> : articles.length ? articles.map(article => <div className="writing-row" key={article.id}><div className="writing-row-title"><a href={'/admin/write/editor?id=' + article.id}>{article.title || '未命名文章'}</a><p>{article.excerpt || (article.is_pinned ? '已置顶' : '暂无摘要')}</p></div><div className="writing-row-meta"><span className={'writing-status ' + article.status}>{tab === 'trash' ? '已删除' : article.status === 'published' ? '已发布' : '草稿'}</span><small>{article.category_name || '未分类'}</small></div><time>{article.updated_at ? new Date(article.updated_at.replace(' ','T')).toLocaleDateString('zh-CN') : '—'}</time><div className="writing-row-actions">{tab === 'trash' ? <><button disabled={pending === article.id} onClick={() => action(article,'restore')}>恢复</button><button className="writing-danger" disabled={pending === article.id} onClick={() => action(article,'force')}>永久删除</button></> : <><a href={'/admin/write/editor?id=' + article.id}>编辑</a><button disabled={pending === article.id} aria-label={'删除 ' + article.title} onClick={() => action(article,'trash')}>删除</button></>}</div></div>) : <div className="writing-empty"><h2>{query ? '没有匹配的文章' : tab === 'trash' ? '回收站是空的' : '这里还没有文章'}</h2><p>{query ? '换一个关键词试试。' : '新建文章或导入网页，开始整理你的想法。'}</p></div>}
      </div><footer className="writing-pagination"><span>共 {total} 篇</span><div><button disabled={loading || page === 1} onClick={() => setPage(page - 1)}>上一页</button><span>{page} / {Math.max(1,Math.ceil(total / 20))}</span><button disabled={loading || page * 20 >= total} onClick={() => setPage(page + 1)}>下一页</button></div></footer></section>
      <p className="writing-workspace-note">TXT、Markdown 与 EPUB 导入，以及完整的发布设置，均可在编辑页使用。</p>
    </div>{importing && <WebImportDialog onClose={() => setImporting(false)}/>}
  </main>;
}
