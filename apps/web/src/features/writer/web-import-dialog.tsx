'use client';
import { useEffect, useRef, useState } from 'react';
import { writingRequest } from './writing-api';

export function WebImportDialog({ onClose, onInsert }: { onClose: () => void; onInsert?: (data: {content: string; web_sources: unknown[]}) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState('');
  const [data, setData] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [keepLinks, setKeepLinks] = useState(true);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => { dialog.current?.showModal(); return () => request.current?.abort(); }, []);
  async function extract(event: React.FormEvent) {
    event.preventDefault(); setBusy('正在提取正文…'); setError('');
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    try {
      const json = await writingRequest('/admin/web-import/preview', {method: 'POST', body: JSON.stringify({url}), signal: controller.signal});
      setData(json.data); setTitle(json.data.title); setImages(json.data.images.map((image: any) => image.id)); setAllowDuplicate(false);
    } catch (error) { if (!controller.signal.aborted) setError((error as Error).message); }
    finally { setBusy(''); }
  }
  async function commit(mode: string) {
    setBusy('正在导入正文与所选图片…'); setError('');
    try {
      const json = await writingRequest('/admin/web-import/commit', {method: 'POST', body: JSON.stringify({preview_id: data.preview_id, title, image_ids: images, mode, keep_links: keepLinks, allow_duplicate: allowDuplicate})});
      if (mode === 'insert' && onInsert) { onInsert(json.data); onClose(); }
      else location.assign('/admin/write/editor?id=' + json.data.id);
    } catch (error) { setError((error as Error).message); setBusy(''); }
  }
  return <dialog ref={dialog} className="web-import-dialog" aria-labelledby="web-import-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><div><span className="writing-eyebrow">WEB IMPORT</span><h2 id="web-import-title">从网页开始写作</h2></div><button type="button" aria-label="关闭网页导入" disabled={!!busy} onClick={onClose}>×</button></header>
    <form className="web-import-url" onSubmit={extract}><label htmlFor="web-import-url">文章链接</label><div><input id="web-import-url" type="url" required placeholder="https://…" value={url} onChange={event => setUrl(event.target.value)} disabled={!!busy}/><button className="writing-primary" disabled={!!busy}>提取正文</button></div></form>
    {error && <p className="writing-error" role="alert">{error}</p>}
    {busy && <p className="writing-notice" role="status">{busy}</p>}
    {data ? <div className="web-import-body">
      <section className="web-import-preview"><div className="web-import-preview-heading"><strong>正文预览</strong><span>{data.characters.toLocaleString()} 字</span></div>
        <iframe title="提取的正文预览" sandbox="" srcDoc={'<!doctype html><html lang="zh"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; style-src &apos;unsafe-inline&apos;"><style>body{font:16px/1.9 system-ui;color:#273b35;margin:28px;overflow-wrap:anywhere}h1,h2,h3{line-height:1.4}pre{white-space:pre-wrap;background:#f2f5f3;padding:16px}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #ddd;padding:8px}a{color:#087b62}</style><body>' + data.html + '</body></html>'}/>
      </section>
      <aside className="web-import-options"><label>文章标题<input value={title} onChange={event => setTitle(event.target.value)} maxLength={300}/></label>
        <div className="web-import-source"><strong>来源信息</strong><span>{data.source.author || '作者未提供'}{data.source.published_at ? ' · ' + data.source.published_at : ''}</span><a href={data.source.final_url} target="_blank" rel="noopener noreferrer">{data.source.final_url}</a></div>
        <label className="writing-check"><input type="checkbox" checked={keepLinks} onChange={event => setKeepLinks(event.target.checked)}/>保留正文链接</label>
        <div className="web-import-image-heading"><strong>图片 · {data.images.length}</strong><button type="button" onClick={() => setImages(images.length ? [] : data.images.map((image: any) => image.id))}>{images.length ? '取消全选' : '全选'}</button></div>
        {data.images.length ? <div className="web-import-images">{data.images.map((image: any) => <label className="writing-check" key={image.id}><input type="checkbox" checked={images.includes(image.id)} onChange={event => setImages(event.target.checked ? [...images, image.id] : images.filter(id => id !== image.id))}/><span><strong>图片 {image.id}{image.alt ? ' · ' + image.alt : ''}</strong><small>{image.url}</small></span></label>)}</div> : <p className="writing-muted">正文中没有图片</p>}
        <p className="writing-muted">选中的图片将存入媒体库，未选中的图片不会导入。导入失败时可取消有问题的图片后重试。</p>
        {!!data.duplicates.length && <div className="web-import-duplicates"><strong>发现已导入的内容</strong>{data.duplicates.map((article: any) => <a key={article.id} href={'/admin/write/editor?id=' + article.id} target="_blank" rel="noopener">{article.title} ↗</a>)}<label className="writing-check"><input type="checkbox" checked={allowDuplicate} onChange={event => setAllowDuplicate(event.target.checked)}/>仍然导入一份</label></div>}
      </aside>
    </div> : <div className="web-import-empty"><span>↗</span><h3>保留内容，去掉网页干扰</h3><p>提取正文、标题与来源，预览后再保存。<br/>需要登录或动态加载的网页暂不支持。</p></div>}
    <footer><span className="writing-muted">仅导入你有权保存的内容，不会自动发布。</span><div>{onInsert && data && <button disabled={!!busy || (!!data.duplicates.length && !allowDuplicate)} onClick={() => commit('insert')}>插入当前文章</button>}<button className="writing-primary" disabled={!data || !!busy || (!!data?.duplicates.length && !allowDuplicate)} onClick={() => commit('draft')}>保存为新草稿</button></div></footer>
  </dialog>;
}
