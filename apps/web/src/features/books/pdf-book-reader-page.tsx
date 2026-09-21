'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import type { BookDetail } from './contracts';
import { ensurePrivateDeviceToken } from '../../shared/device/private-device';
import { MobileReaderShell } from '../../shared/reader/mobile-reader-shell';
import { MobileReaderMusic } from '../../shared/reader/mobile-reader-music';
import './reader-controls.css';

const defaults = { theme: 'day', width: 860, margin: 16, zoom: 1 };
const progressKey = (bookId: number) => `boke-pdf-progress-v1:${bookId}`;

function storedPage(value: unknown) {
  const page = Math.floor(Number(value) || 1);
  return Math.max(1, page);
}

function PdfCanvasPage({
  pdf,
  pageNumber,
  active,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  active: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (active || !frame.current || !canvas.current) return;
    canvas.current.width = 1;
    canvas.current.height = 1;
    delete frame.current.dataset.rendered;
  }, [active]);

  useEffect(() => {
    if (!active || !frame.current || !canvas.current) return;
    let disposed = false;
    let task: RenderTask | null = null;
    let loadedPage: PDFPageProxy | null = null;
    let resizeFrame = 0;

    const render = async () => {
      const holder = frame.current;
      const target = canvas.current;
      if (!holder || !target || disposed) return;
      const page = await pdf.getPage(pageNumber);
      loadedPage = page;
      const natural = page.getViewport({ scale: 1 });
      const cssWidth = Math.max(240, holder.clientWidth);
      const viewport = page.getViewport({ scale: cssWidth / natural.width });
      const density = Math.min(2, window.devicePixelRatio || 1);
      holder.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
      target.width = Math.floor(viewport.width * density);
      target.height = Math.floor(viewport.height * density);
      target.style.width = `${Math.floor(viewport.width)}px`;
      target.style.height = `${Math.floor(viewport.height)}px`;
      const context = target.getContext('2d', { alpha: false });
      if (!context || disposed) return;
      task?.cancel();
      task = page.render({
        canvas: target,
        canvasContext: context,
        viewport,
        transform: density === 1 ? undefined : [density, 0, 0, density, 0, 0],
      });
      await task.promise.catch((error: { name?: string }) => {
        if (error?.name !== 'RenderingCancelledException') throw error;
      });
      if (!disposed) holder.dataset.rendered = 'true';
    };

    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => void render());
    });
    resize.observe(frame.current);
    void render();
    return () => {
      disposed = true;
      cancelAnimationFrame(resizeFrame);
      resize.disconnect();
      task?.cancel();
      loadedPage?.cleanup();
    };
  }, [active, pageNumber, pdf]);

  return (
    <div className="pdf-canvas-page" data-pdf-page={pageNumber} ref={frame}>
      <canvas ref={canvas} aria-label={`第 ${pageNumber} 页`} />
      <span>{pageNumber}</span>
    </div>
  );
}

export function PdfBookReaderPage({ book }: { book: BookDetail }) {
  const localDocument = String(book.reading_url || '').startsWith('/uploads/');
  const version = encodeURIComponent(String(book.updated_at || '1'));
  const source = localDocument
    ? `/api/books/${encodeURIComponent(book.slug)}/document/file?v=${version}`
    : String(book.reading_url || '');
  const downloadUrl = localDocument
    ? `/api/books/${encodeURIComponent(book.slug)}/document/file?download=1`
    : source;
  const contentsUrl = `/books/${encodeURIComponent(book.slug)}`;
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [prefs, setPrefs] = useState(defaults);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [progressReady, setProgressReady] = useState(false);
  const [positionRestored, setPositionRestored] = useState(false);
  const [cached, setCached] = useState(false);
  const settings = useRef<HTMLDialogElement>(null);
  const scrollFrame = useRef(0);
  const resumePage = useRef(1);
  const currentPageRef = useRef(1);
  const progressRevision = useRef(0);
  const deviceToken = useRef('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('boke-book-reader-appearance') || '{}');
      setPrefs({
        theme: ['day', 'paper', 'eye', 'night'].includes(saved.theme) ? saved.theme : 'day',
        width: Math.max(560, Math.min(1200, Number(saved.width) || defaults.width)),
        margin: Math.max(8, Math.min(40, Number(saved.margin) || defaults.margin)),
        zoom: Math.max(.7, Math.min(1.6, Number(saved.pdfZoom) || defaults.zoom)),
      });
    } catch {}
  }, []);

  useEffect(() => {
    let disposed = false;
    let localPage = 1;
    try {
      localPage = storedPage(JSON.parse(localStorage.getItem(progressKey(book.id)) || '{}').page);
    } catch {}
    resumePage.current = localPage;
    setCurrentPage(localPage);
    currentPageRef.current = localPage;
    void (async () => {
      try {
        const token = await ensurePrivateDeviceToken('/api');
        if (!token || disposed) return;
        deviceToken.current = token;
        const response = await fetch(`/api/private/books/${book.id}/progress`, {
          headers: { 'X-Device-Token': token },
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json.data || disposed) return;
        progressRevision.current = Number(json.data.revision) || 0;
        const serverPage = storedPage(json.data.settings?.pdfPage);
        if (json.data.settings?.documentType === 'pdf' || Number(json.data.settings?.pdfPage) > 0) {
          resumePage.current = serverPage;
          setCurrentPage(serverPage);
          currentPageRef.current = serverPage;
        }
      } catch {
        /* Local progress remains available without private sync. */
      } finally {
        if (!disposed) setProgressReady(true);
      }
    })();
    return () => { disposed = true; };
  }, [book.id]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('boke-book-reader-appearance') || '{}');
      localStorage.setItem('boke-book-reader-appearance', JSON.stringify({ ...saved, theme: prefs.theme, width: prefs.width, margin: prefs.margin, pdfZoom: prefs.zoom }));
    } catch {}
  }, [prefs]);

  useEffect(() => {
    let disposed = false;
    let loadingTask: { promise: Promise<PDFDocumentProxy>; destroy: () => Promise<void> } | null = null;
    setError('');
    void import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
      if (disposed) return;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
      loadingTask = pdfjs.getDocument({
        url: source,
        rangeChunkSize: 64 * 1024,
        disableAutoFetch: true,
        disableStream: true,
      });
      return loadingTask.promise;
    }).then((document) => {
      if (document && !disposed) setPdf(document);
    }).catch((reason) => {
      if (!disposed) setError(reason instanceof Error ? reason.message : 'PDF 加载失败');
    });
    return () => {
      disposed = true;
      void loadingTask?.destroy();
    };
  }, [source]);

  useEffect(() => {
    if (!pdf || !progressReady) return;
    const page = Math.min(pdf.numPages, resumePage.current);
    setCurrentPage(page);
    currentPageRef.current = page;
    const firstFrame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-pdf-page="${page}"]`)?.scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
        setPositionRestored(true);
      });
    });
    return () => cancelAnimationFrame(firstFrame);
  }, [pdf, progressReady]);

  useEffect(() => {
    if (!pdf || !positionRestored) return;
    const measure = () => {
      scrollFrame.current = 0;
      const middle = window.innerHeight / 2;
      let closest = currentPageRef.current;
      let distance = Number.POSITIVE_INFINITY;
      document.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach((page) => {
        const rect = page.getBoundingClientRect();
        const nextDistance = Math.abs(rect.top + rect.height / 2 - middle);
        if (nextDistance < distance) {
          distance = nextDistance;
          closest = Number(page.dataset.pdfPage) || 1;
        }
      });
      if (closest !== currentPageRef.current) {
        currentPageRef.current = closest;
        setCurrentPage(closest);
      }
    };
    const requestMeasure = () => {
      if (!scrollFrame.current) scrollFrame.current = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', requestMeasure, { passive: true });
    window.addEventListener('resize', requestMeasure);
    return () => {
      cancelAnimationFrame(scrollFrame.current);
      window.removeEventListener('scroll', requestMeasure);
      window.removeEventListener('resize', requestMeasure);
    };
  }, [pdf, positionRestored]);

  useEffect(() => {
    if (!pdf || !positionRestored) return;
    const total = pdf.numPages;
    const position = total > 1 ? (currentPage - 1) / (total - 1) : 1;
    try {
      localStorage.setItem(progressKey(book.id), JSON.stringify({ page: currentPage, total, updatedAt: Date.now() }));
    } catch {}
    const timer = window.setTimeout(async () => {
      try {
        const token = deviceToken.current || await ensurePrivateDeviceToken('/api');
        if (!token) return;
        deviceToken.current = token;
        const response = await fetch(`/api/private/books/${book.id}/progress`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Device-Token': token },
          body: JSON.stringify({
            position,
            mode: 'scroll',
            revision: progressRevision.current,
            settings: { ...prefs, documentType: 'pdf', pdfPage: currentPage, pdfPages: total },
          }),
        });
        const json = await response.json().catch(() => ({}));
        if (response.ok) progressRevision.current = Number(json.data?.revision) || progressRevision.current;
      } catch {
        /* The local page is still restored when sync is unavailable. */
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [book.id, currentPage, pdf, positionRestored, prefs]);

  useEffect(() => {
    if (!pdf || !localDocument || !('serviceWorker' in navigator)) return;
    let disposed = false;
    void navigator.serviceWorker.ready.then((registration) => {
      if (disposed || !registration.active) return;
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => channel.port1.close(), 120000);
      channel.port1.onmessage = ({ data }) => {
        if (data?.type === 'CACHE_PDF_DONE' && data.saved) setCached(true);
        clearTimeout(timeout);
        channel.port1.close();
      };
      registration.active.postMessage({ type: 'CACHE_PDF', url: source }, [channel.port2]);
    }).catch(() => {});
    return () => { disposed = true; };
  }, [localDocument, pdf, source]);

  const update = (values: Partial<typeof defaults>) => setPrefs((old) => ({ ...old, ...values }));
  const goToPage = (page: number) => {
    const next = Math.max(1, Math.min(pdf?.numPages || 1, page));
    document.querySelector<HTMLElement>(`[data-pdf-page="${next}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    currentPageRef.current = next;
    setCurrentPage(next);
  };
  const colors: Record<string, string> = { day: '#fafaf8', paper: '#f6efdc', eye: '#e9f1e8', night: '#1d211f' };
  const total = pdf?.numPages || 0;

  return (
    <div
      className="reading-workspace reading-pdf-workspace"
      data-theme={prefs.theme}
      data-controls={controlsOpen}
      style={{
        '--reading-bg': colors[prefs.theme] || colors.day,
        '--reading-width': `${Math.round(prefs.width * prefs.zoom)}px`,
        '--reading-margin': `${prefs.margin}px`,
      } as CSSProperties}
    >
      <main className="reading-paper reading-pdf-paper">
        <header className="reading-heading">
          <a href={contentsUrl}>← 返回书籍</a>
          <small>PDF DOCUMENT</small>
          <h1>{book.title}</h1>
          <span>{total ? `第 ${currentPage} / ${total} 页${cached ? ' · 已缓存' : ''}` : '正在载入文档…'}</span>
        </header>
        {error && (
          <section className="pdf-reading-error">
            <strong>PDF 加载失败</strong>
            <p>{error}</p>
            <div><button type="button" onClick={() => location.reload()}>重新加载</button><a href={downloadUrl}>下载原文件</a></div>
          </section>
        )}
        {!pdf && !error && <section className="pdf-reading-loading"><i /><span>正在读取 PDF 目录与首页…</span></section>}
        {pdf && (
          <section className="pdf-reading-pages" aria-label={`${book.title} PDF 页面`}>
            {Array.from({ length: pdf.numPages }, (_, index) => {
              const pageNumber = index + 1;
              return <PdfCanvasPage key={pageNumber} pdf={pdf} pageNumber={pageNumber} active={Math.abs(pageNumber - currentPage) <= 2} />;
            })}
          </section>
        )}
      </main>

      <aside className="reading-actions" aria-label="PDF 阅读工具">
        <a href={contentsUrl}>←<span>返回</span></a>
        <button type="button" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>↑<span>上页</span></button>
        <button type="button" disabled={!total || currentPage >= total} onClick={() => goToPage(currentPage + 1)}>↓<span>下页</span></button>
        <button type="button" onClick={() => update({ theme: prefs.theme === 'night' ? 'day' : 'night' })}>☾<span>夜间</span></button>
        <button type="button" onClick={() => settings.current?.showModal()}>Aa<span>设置</span></button>
        <button type="button" onClick={() => document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen?.().catch(() => {})}>⛶<span>沉浸</span></button>
      </aside>

      <MobileReaderShell
        open={controlsOpen}
        onOpenChange={setControlsOpen}
        backHref={contentsUrl}
        title={book.title}
        subtitle="PDF 阅读"
        progress={total ? `${currentPage} / ${total}` : '载入中'}
        actions={[
          { label: '上一页', icon: '↑', onClick: () => goToPage(currentPage - 1) },
          { label: '下一页', icon: '↓', onClick: () => goToPage(currentPage + 1) },
          { label: '夜间', icon: '☾', onClick: () => update({ theme: prefs.theme === 'night' ? 'day' : 'night' }) },
          { label: '设置', icon: 'Aa', primary: true, onClick: () => settings.current?.showModal() },
          { label: '沉浸', icon: '⛶', onClick: () => document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen?.().catch(() => {}) },
        ]}
      />

      <dialog className="reading-settings" ref={settings} aria-labelledby="pdf-reading-settings-title">
        <form method="dialog">
          <header><h2 id="pdf-reading-settings-title">PDF 阅读设置</h2><button aria-label="关闭阅读设置">×</button></header>
          <label>页面宽度 <output>{prefs.width}px</output><input type="range" min="560" max="1200" step="40" value={prefs.width} onChange={(event) => update({ width: Number(event.target.value) })} /></label>
          <label>页面缩放 <output>{Math.round(prefs.zoom * 100)}%</output><input type="range" min=".7" max="1.6" step=".1" value={prefs.zoom} onChange={(event) => update({ zoom: Number(event.target.value) })} /></label>
          <fieldset><legend>阅读背景</legend><div className="reading-themes">{Object.entries({ day: '日间', paper: '纸张', eye: '护眼', night: '夜间' }).map(([key, label]) => <button type="button" key={key} aria-pressed={prefs.theme === key} onClick={() => update({ theme: key })}>{label}</button>)}</div></fieldset>
          <MobileReaderMusic />
          <footer><a href={downloadUrl}>下载原文件</a><button className="primary">完成</button></footer>
        </form>
      </dialog>
    </div>
  );
}
