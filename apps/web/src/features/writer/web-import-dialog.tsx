'use client';
import { useEffect, useRef, useState } from 'react';
import { writingRequest } from './writing-api';

export function WebImportDialog({ onClose, onInsert }: { onClose: () => void; onInsert?: (data: {content: string; web_sources: unknown[]}) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'url' | 'paste'>('url');
  const [pastedHtml, setPastedHtml] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [pastedTitle, setPastedTitle] = useState('');
  const [data, setData] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [keepLinks, setKeepLinks] = useState(true);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => { dialog.current?.showModal(); return () => request.current?.abort(); }, []);
  function changeMode(value: 'url' | 'paste') { setMode(value); setData(null); setError(''); }
  function receivePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    if (!html && !text) return;
    event.preventDefault(); setData(null); setError('');
    setPastedHtml(html); setPastedText(text || '已读取网页图文，请点击“整理并预览”。');
  }
  async function readHtmlFile(file?: File) {
    if (!file) return;
    if (!/\.html?$/i.test(file.name) || file.size > 6 * 1024 * 1024) { setError('请选择不超过 6 MB 的 HTML 网页文件'); return; }
    try { setPastedHtml(await file.text()); setPastedText('已读取：' + file.name); setData(null); setError(''); }
    catch { setError('文件读取失败，请重试'); }
  }
  async function extract(event: React.FormEvent) {
    event.preventDefault(); setData(null); setError('');
    if (mode === 'paste' && !pastedHtml.trim() && !pastedText.trim()) { setError('请先从文章页面复制图文并粘贴到下方'); return; }
    setBusy(mode === 'paste' ? '正在整理图文…' : '正在加载并提取文章，动态页面可能需要约 45 秒…');
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    try {
      const plainHtml = '<article>' + pastedText.split(/\n+/).map(line => '<p>' + line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</p>').join('') + '</article>';
      const payload = mode === 'paste' ? {url, html: pastedHtml || plainHtml, title: pastedTitle} : {url};
      const json = await writingRequest('/admin/web-import/preview', {method: 'POST', body: JSON.stringify(payload), signal: controller.signal});
      setData(json.data); setTitle(json.data.title); setImages(json.data.images.map((image: any) => image.id)); setAllowDuplicate(false);
    } catch (error) {
      if (!controller.signal.aborted) {
        setError((error as Error).message);
        if (['VERIFICATION_REQUIRED', 'DYNAMIC_EMPTY'].includes((error as Error & {code?: string}).code || '')) setMode('paste');
      }
    }
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
    <div className="web-import-modes" aria-label="导入方式"><button type="button" aria-pressed={mode === 'url'} disabled={!!busy} onClick={() => changeMode('url')}>链接提取</button><button type="button" aria-pressed={mode === 'paste'} disabled={!!busy} onClick={() => changeMode('paste')}>粘贴图文</button></div>
    <form className="web-import-url" onSubmit={extract}><label htmlFor="web-import-url">{mode === 'paste' ? '原文章链接（用于保留来源）' : '文章链接'}</label><div><input id="web-import-url" type="url" required placeholder="https://…" value={url} onChange={event => { setUrl(event.target.value); setData(null); }} disabled={!!busy}/><button className="writing-primary" disabled={!!busy}>{mode === 'paste' ? '整理并预览' : '提取正文'}</button></div></form>
    {mode === 'paste' && <section className="web-import-paste">
      <p>在原网页选中文章正文并复制，粘贴到下方。电脑浏览器会同时保留图文；若只复制到文字，将仅导入文字。</p>
      <label htmlFor="web-import-paste-title">文章标题（可选）</label><input id="web-import-paste-title" value={pastedTitle} maxLength={300} disabled={!!busy} onChange={event => { setPastedTitle(event.target.value); setData(null); }}/>
      <label htmlFor="web-import-paste-content">文章图文</label><textarea id="web-import-paste-content" rows={6} placeholder="在这里粘贴复制的文章内容" disabled={!!busy} value={pastedText} onPaste={receivePaste} onChange={event => { setPastedText(event.target.value); setPastedHtml(''); setData(null); }}/>
      <div><span className="writing-muted">{pastedHtml ? '已保留图文格式；预览前不会加载外部图片。' : '支持复制粘贴正文，也可导入保存的网页 HTML。'}</span><label className="web-import-file">选择 HTML 文件<input type="file" accept=".html,.htm,text/html" disabled={!!busy} onChange={event => { void readHtmlFile(event.target.files?.[0]); event.target.value = ''; }}/></label></div>
    </section>}
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
    </div> : mode === 'url' && <div className="web-import-empty"><span>↗</span><h3>保留内容，去掉网页干扰</h3><p>支持普通文章与动态加载的文章，预览后再保存。<br/>需要登录或验证时，可从已打开的文章复制图文导入。</p></div>}
    <footer><span className="writing-muted">仅导入你有权保存的内容，不会自动发布。</span><div>{onInsert && data && <button disabled={!!busy || (!!data.duplicates.length && !allowDuplicate)} onClick={() => commit('insert')}>插入当前文章</button>}<button className="writing-primary" disabled={!data || !!busy || (!!data?.duplicates.length && !allowDuplicate)} onClick={() => commit('draft')}>保存为新草稿</button></div></footer>
  </dialog>;
}
