'use client';
import { useEffect, useState } from 'react';
import { ensurePrivateDeviceToken } from '../../shared/device/private-device';
import { cacheReading } from '../pwa/cache-reading';
interface ReadingRecord {
  kind: 'book' | 'manga';
  id?: number;
  title: string;
  cover?: string;
  section_title?: string;
  chapter_title?: string;
  progress?: number;
  href?: string;
}
function OfflineButton({ href }: { href: string }) {
  const [state, setState] = useState('离线'),
    [busy, setBusy] = useState(false);
  return (
    <button
      data-offline={href}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        setState('准备中');
        try {
          await cacheReading(href);
          setState('已保存');
        } catch {
          setState('失败');
        } finally {
          setBusy(false);
        }
      }}
    >
      {state}
    </button>
  );
}
export function ReadingHub() {
  const [items, setItems] = useState<ReadingRecord[]>([]),
    [kind, setKind] = useState(''),
    [status, setStatus] = useState<'loading' | 'ready' | 'unauthorized' | 'error'>('loading');
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    void (async () => {
      try {
        const token = await ensurePrivateDeviceToken('/api');
        if (disposed) return;
        if (!token) {
          setStatus('unauthorized');
          return;
        }
        const response = await fetch('/api/private/reading-center', {
            headers: { 'X-Device-Token': token },
            signal: controller.signal,
          }),
          json = await response.json();
        if (disposed) return;
        if (!response.ok) throw new Error('读取失败');
        setItems(Array.isArray(json.data) ? json.data : []);
        setStatus('ready');
      } catch {
        if (!disposed) setStatus('error');
      }
    })();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, []);
  const rows = items.filter((item) => !kind || item.kind === kind);
  const summary =
    status === 'loading'
      ? '正在读取私人记录…'
      : status === 'unauthorized'
        ? '需要私人设备授权'
        : status === 'error'
          ? '读取失败'
          : `${rows.length} 条阅读记录`;
  return (
    <section className="reading-hub" data-reading-hub="" data-api-base="/api">
      <header>
        <div>
          <p>PRIVATE READING</p>
          <h1>继续阅读</h1>
          <span>小说和漫画共用一条跨设备时间线，也可以保存当前章节离线阅读。</span>
        </div>
        <nav>
          <a href="/books">书库</a>
          <a href="/manga">漫画</a>
        </nav>
      </header>
      <div className="reading-hub-filter">
        <button className={kind === '' ? 'active' : ''} data-kind="" onClick={() => setKind('')}>
          全部
        </button>
        <button
          className={kind === 'book' ? 'active' : ''}
          data-kind="book"
          onClick={() => setKind('book')}
        >
          小说
        </button>
        <button
          className={kind === 'manga' ? 'active' : ''}
          data-kind="manga"
          onClick={() => setKind('manga')}
        >
          漫画
        </button>
        <span data-summary="">{summary}</span>
      </div>
      <div className="reading-hub-list" data-list="">
        {status === 'unauthorized' ? (
          <p className="reading-empty">请先登录后台，将当前设备登记为私人设备。</p>
        ) : (
          rows.map((item, index) => (
            <article className="reading-item" key={`${item.kind}:${item.id || item.href || index}`}>
              {item.cover ? (
                <img src={item.cover} alt="" />
              ) : (
                <span className="cover">{item.kind === 'manga' ? '漫' : '书'}</span>
              )}
              <div className="min-w-0">
                <small>
                  {item.kind === 'manga' ? '漫画' : '小说'} · {item.section_title || ''}
                </small>
                <h2>{item.title}</h2>
                <p>{item.chapter_title || '尚未定位章节'}</p>
                <div className="reading-progress">
                  <i style={{ width: `${Math.round(Number(item.progress || 0) * 100)}%` }} />
                </div>
                <footer>
                  <a href={item.href || '#'}>继续阅读 →</a>
                  <OfflineButton href={item.href || ''} />
                </footer>
              </div>
            </article>
          ))
        )}
        {status !== 'loading' && status !== 'unauthorized' && !rows.length && (
          <p className="reading-empty">还没有阅读记录，打开一本书或漫画后会自动出现在这里。</p>
        )}
      </div>
    </section>
  );
}
