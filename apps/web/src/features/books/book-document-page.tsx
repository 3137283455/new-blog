'use client';

import { useEffect, useState } from 'react';
import type { BookDetail } from './contracts';

export function BookDocumentPage({ book }: { book: BookDetail }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const localDocument = String(book.reading_url || '').startsWith('/uploads/');
  const source = localDocument
    ? `/api/books/${encodeURIComponent(book.slug)}/document/file`
    : String(book.reading_url || '');
  const downloadUrl = localDocument ? `${source}?download=1` : source;
  const [ready, setReady] = useState(!localDocument);

  useEffect(() => {
    if (!localDocument) return;
    const controller = new AbortController();
    void fetch(source, { headers: { Range: 'bytes=0-4' }, signal: controller.signal })
      .then(async (response) => {
        const contentType = response.headers.get('content-type') || '';
        if (![200, 206].includes(response.status) || !contentType.startsWith('application/pdf')) throw new Error('PDF unavailable');
        const signature = new TextDecoder('ascii').decode(await response.arrayBuffer());
        if (signature !== '%PDF-') throw new Error('Invalid PDF');
        setReady(true);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setFailed(true);
      });
    return () => controller.abort();
  }, [localDocument, source]);

  return (
    <article className="pdf-reader-page">
      <header className="pdf-reader-toolbar">
        <a className="pdf-reader-back" href={`/books/${encodeURIComponent(book.slug)}`} aria-label="返回书籍详情">
          <span aria-hidden="true">←</span>
          <b>返回书籍</b>
        </a>
        <div>
          <small>PDF READER</small>
          <strong>{book.title}</strong>
        </div>
        <nav aria-label="PDF 操作">
          <a href={source} target="_blank" rel="noopener noreferrer">新窗口</a>
          <a href={downloadUrl}>下载</a>
        </nav>
      </header>

      <section className="pdf-reader-stage" aria-label={`${book.title} PDF 阅读器`}>
        {!loaded && !failed && <div className="pdf-reader-loading"><i /><span>正在载入 PDF…</span></div>}
        {failed && (
          <div className="pdf-reader-fallback">
            <strong>当前浏览器无法内嵌显示 PDF</strong>
            <p>可以在新窗口中打开，或下载后使用本地阅读器。</p>
            <div><a href={source} target="_blank" rel="noopener noreferrer">新窗口打开</a><a href={downloadUrl}>下载 PDF</a></div>
          </div>
        )}
        {ready && !failed && (
          <iframe
            className={loaded ? 'is-loaded' : ''}
            src={`${source}#view=FitH&toolbar=1&navpanes=0`}
            title={`${book.title} PDF`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            allowFullScreen
          />
        )}
      </section>
    </article>
  );
}
