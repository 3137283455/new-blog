'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

const articleHref = (value: string) => `/article/${encodeURIComponent(value)}`;
const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('zh-CN') : '未标注日期';
const relationLabels: Record<string, string> = {
  related: '相关内容',
  review: '观后感',
  adaptation: '改编作品',
  soundtrack: '背景音乐',
};

type Heading = { id: string; text: string; level: number };
type ReadingPreferences = {
  fontSize: number;
  lineHeight: number;
  width: number;
  focus: boolean;
};

const defaultPreferences: ReadingPreferences = {
  fontSize: 18,
  lineHeight: 1.85,
  width: 900,
  focus: false,
};

function extractHeadings(html: string): Heading[] {
  const headings: Heading[] = [];
  const expression = /<h([2-4])(?:\s[^>]*)?id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/h\1>/gi;
  for (const match of html.matchAll(expression)) {
    headings.push({
      level: Number(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(),
    });
  }
  return headings;
}

function ToolIcon({ name }: { name: 'toc' | 'bookmark' | 'share' | 'reading' | 'top' }) {
  if (name === 'toc') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>;
  if (name === 'bookmark') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.6L6 21V4.8Z" /></svg>;
  if (name === 'share') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" /></svg>;
  if (name === 'reading') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M9 18h6" /><circle cx="8" cy="6" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="12" cy="18" r="1.5" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6-6 6 6M12 4v16" /></svg>;
}

export function ArticleReader({ article }: { article: any }) {
  const html = article.content_html || `<p>${article.excerpt || ''}</p>`;
  const headings = useMemo(() => extractHeadings(html), [html]);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const [progress, setProgress] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [preferences, setPreferences] = useState<ReadingPreferences>(defaultPreferences);
  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('boke-reading-settings-v1') || '{}');
      setPreferences({ ...defaultPreferences, ...saved });
      const bookmarks = JSON.parse(localStorage.getItem('boke-article-bookmarks-v1') || '[]');
      setBookmarked(Array.isArray(bookmarks) && bookmarks.some((item) => item.slug === article.slug));
    } catch {}
  }, [article.slug]);

  useEffect(() => {
    document.body.classList.toggle('article-focus-mode', preferences.focus);
    try {
      localStorage.setItem('boke-reading-settings-v1', JSON.stringify(preferences));
    } catch {}
    return () => document.body.classList.remove('article-focus-mode');
  }, [preferences]);

  useEffect(() => {
    const update = () => {
      const maximum = document.documentElement.scrollHeight - window.innerHeight;
      const value = maximum > 0 ? Math.min(1, Math.max(0, window.scrollY / maximum)) : 0;
      setProgress(Math.round(value * 100));
      try {
        const key = 'boke-reading-history-v1';
        const history = JSON.parse(localStorage.getItem(key) || '[]');
        const next = [
          {
            slug: article.slug,
            title: article.title,
            progress: value,
            completed: value > 0.96,
            updated_at: Date.now(),
          },
          ...(Array.isArray(history) ? history.filter((item) => item.slug !== article.slug) : []),
        ].slice(0, 20);
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [article.slug, article.title]);

  const toggleBookmark = () => {
    const nextState = !bookmarked;
    setBookmarked(nextState);
    try {
      const key = 'boke-article-bookmarks-v1';
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      const current = Array.isArray(value) ? value.filter((item) => item.slug !== article.slug) : [];
      if (nextState) current.unshift({ slug: article.slug, title: article.title, saved_at: Date.now() });
      localStorage.setItem(key, JSON.stringify(current.slice(0, 50)));
    } catch {}
  };

  const shareArticle = async () => {
    const payload = { title: article.title, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(payload);
      else await navigator.clipboard.writeText(payload.url);
    } catch {}
  };

  const contentStyle = {
    '--article-reader-size': `${preferences.fontSize}px`,
    '--article-reader-leading': String(preferences.lineHeight),
    '--article-reader-width': `${preferences.width}px`,
  } as CSSProperties;

  return (
    <>
      <div className="article-reading-progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
      <div className="article-reading-layout article-restored-layout" style={contentStyle}>
        <div className="article-reading-main">
          <article className="article-content-card ryu-card p-6 md:p-10">
            <header className="article-content-head mb-10 border-b border-base-content/10 pb-8 text-center">
              <div className="mb-4 flex flex-wrap justify-center gap-2">
                {article.category_name && <span className="badge badge-primary badge-outline">{article.category_name}</span>}
                {article.series_title && <a className="badge badge-secondary badge-outline" href={`/series/${encodeURIComponent(article.series_slug || '')}`}>专题 · {article.series_title}</a>}
                <span className="badge badge-ghost">{formatDate(article.published_at || article.created_at)}</span>
              </div>
              <h1 className="mx-auto max-w-3xl text-4xl font-black leading-tight md:text-5xl">{article.title}</h1>
              <p className="mt-4 text-sm text-base-content/50">
                {article.view_count || 0} 阅读 · {article.comment_count || 0} 评论
                {article.like_count !== undefined && <> · {article.like_count || 0} 喜欢</>}
              </p>
            </header>

            {article.series_title && article.series_articles?.length ? (
              <aside className="article-series-progress">
                <div>
                  <small>ARTICLE SERIES</small>
                  <strong>{article.series_title}</strong>
                  <span>第 {article.series_position || 1} / {article.series_articles.length} 篇</span>
                </div>
                <ol>
                  {article.series_articles.map((item: any, index: number) => (
                    <li className={item.id === article.id ? 'is-current' : ''} key={item.id}>
                      <a href={articleHref(item.slug)}><span>{index + 1}</span>{item.title}</a>
                    </li>
                  ))}
                </ol>
                <i style={{ '--series-progress': `${Math.round(((article.series_position || 1) / article.series_articles.length) * 100)}%` } as CSSProperties} />
              </aside>
            ) : null}

            <article className="markdown-body prose prose-lg max-w-none article-restored-body" dangerouslySetInnerHTML={{ __html: html }} />
          </article>

          {(article.previous || article.next || article.related?.length || article.custom_relations?.length) && (
            <section className="article-discovery" aria-label="继续阅读">
              {(article.previous || article.next) && (
                <div className="article-neighbors">
                  {article.previous ? <a href={articleHref(article.previous.slug)}><span>← 上一篇</span><strong>{article.previous.title}</strong></a> : <div />}
                  {article.next && <a className="is-next" href={articleHref(article.next.slug)}><span>下一篇 →</span><strong>{article.next.title}</strong></a>}
                </div>
              )}
              {article.related?.length ? (
                <div className="article-related">
                  <header><div><p>KEEP READING</p><h2>相关推荐</h2></div><span>{article.related.length} 篇</span></header>
                  <div>{article.related.map((post: any, index: number) => <a href={articleHref(post.slug)} key={post.id}><small>{String(index + 1).padStart(2, '0')}</small><strong>{post.title}</strong><span>{post.category_name || '文章'} · {post.view_count || 0} 阅读</span></a>)}</div>
                </div>
              ) : null}
              {article.custom_relations?.length ? (
                <div className="article-related article-related-content">
                  <header><div><p>CONNECTED CONTENT</p><h2>关联内容</h2></div><span>{article.custom_relations.length} 项</span></header>
                  <div>{article.custom_relations.map((item: any) => <a href={item.href} key={`relation-${item.id}`}><small>{relationLabels[item.relation_type] || item.kind_label || '关联'}</small><strong>{item.title}</strong><span>{item.subtitle || item.meta || item.note || item.kind_label}</span></a>)}</div>
                </div>
              ) : null}
            </section>
          )}
        </div>

        <aside className={`article-reading-side${headings.length ? ' has-toc' : ''}`} aria-label="文章侧栏">
          {headings.length > 0 && (
            <section className={`article-toc-card ryu-card p-5${tocOpen ? ' is-mobile-open' : ''}`}>
              <h2>文章目录</h2>
              <nav aria-label="文章目录">
                {headings.map((item) => <a className={`article-toc-link level-${item.level}`} href={`#${item.id}`} key={item.id} onClick={() => setTocOpen(false)}>{item.text}</a>)}
              </nav>
            </section>
          )}
          <div className="article-action-wrap">
            <div className="article-action-dock" aria-label="文章操作">
              {headings.length > 0 && <button type="button" title="文章目录" onClick={() => setTocOpen(!tocOpen)}><ToolIcon name="toc" /><span>目录</span></button>}
              <button className={bookmarked ? 'is-bookmarked' : ''} type="button" title="收藏文章" aria-pressed={bookmarked} onClick={toggleBookmark}><ToolIcon name="bookmark" /><span>{bookmarked ? '已收藏' : '收藏'}</span></button>
              <button type="button" title="分享文章" onClick={() => void shareArticle()}><ToolIcon name="share" /><span>分享</span></button>
              <button type="button" title="阅读设置" onClick={() => settingsDialog.current?.showModal()}><ToolIcon name="reading" /><span>阅读</span></button>
              <button type="button" title="回到顶部" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ToolIcon name="top" /><span>顶部</span><small>{progress}</small></button>
            </div>
          </div>
        </aside>
      </div>

      <dialog ref={settingsDialog} className="reading-settings-dialog" aria-labelledby="reading-settings-title">
        <div className="reading-settings-panel">
          <header>
            <div><small>READING MODE</small><h2 id="reading-settings-title">阅读设置</h2></div>
            <button type="button" aria-label="关闭阅读设置" onClick={() => settingsDialog.current?.close()}>×</button>
          </header>
          <label className="reading-range-control">
            <span><b>正文字号</b><output>{preferences.fontSize}px</output></span>
            <input type="range" min="16" max="24" step="1" value={preferences.fontSize} onChange={(event) => setPreferences((value) => ({ ...value, fontSize: Number(event.target.value) }))} />
          </label>
          <fieldset>
            <legend>行间距</legend>
            <div className="reading-segmented">
              {[1.65, 1.85, 2.05].map((value) => <button className={preferences.lineHeight === value ? 'is-active' : ''} type="button" key={value} onClick={() => setPreferences((state) => ({ ...state, lineHeight: value }))}>{value === 1.65 ? '紧凑' : value === 1.85 ? '舒适' : '宽松'}</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>正文宽度</legend>
            <div className="reading-segmented">
              {[760, 900, 1040].map((value) => <button className={preferences.width === value ? 'is-active' : ''} type="button" key={value} onClick={() => setPreferences((state) => ({ ...state, width: value }))}>{value === 760 ? '专注' : value === 900 ? '标准' : '宽屏'}</button>)}
            </div>
          </fieldset>
          <label className="reading-focus-toggle"><span><b>专注模式</b><small>隐藏横幅与页脚，只保留文章</small></span><input type="checkbox" checked={preferences.focus} onChange={(event) => setPreferences((value) => ({ ...value, focus: event.target.checked }))} /></label>
          <footer>
            <button type="button" onClick={() => setPreferences(defaultPreferences)}>恢复默认</button>
            <button type="button" onClick={() => settingsDialog.current?.close()}>完成</button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
