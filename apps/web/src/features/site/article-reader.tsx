'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MobileReaderShell } from '../../shared/reader/mobile-reader-shell';
import { MobileReaderMusic } from '../../shared/reader/mobile-reader-music';
import '../books/reader-controls.css';

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
  theme: string;
  fontSize: number;
  lineHeight: number;
  width: number;
  margin: number;
  font: string;
  background: string;
  focus: boolean;
};

const defaultPreferences: ReadingPreferences = {
  theme: 'day',
  fontSize: 20,
  lineHeight: 1.9,
  width: 760,
  margin: 20,
  font: 'serif',
  background: '#f6efdc',
  focus: false,
};

const defaultFeatures = [
  'reading-progress',
  'table-of-contents',
  'word-count',
  'back-to-top',
  'article-like',
  'reading-history',
  'article-bookmark',
  'reading-mode',
  'code-copy',
];

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

function ToolIcon({ name }: { name: 'toc' | 'bookmark' | 'share' | 'reading' | 'top' | 'like' }) {
  if (name === 'toc') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>;
  if (name === 'bookmark') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.6L6 21V4.8Z" /></svg>;
  if (name === 'share') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" /></svg>;
  if (name === 'reading') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M9 18h6" /><circle cx="8" cy="6" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="12" cy="18" r="1.5" /></svg>;
  if (name === 'like') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6-6 6 6M12 4v16" /></svg>;
}

export function ArticleReader({ article }: { article: any }) {
  const html = article.content_html || `<p>${article.excerpt || ''}</p>`;
  const headings = useMemo(() => extractHeadings(html), [html]);
  const wordCount = useMemo(() => html.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length, [html]);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const progressRestored = useRef(false);
  const [progress, setProgress] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(Number(article.like_count || 0));
  const [features, setFeatures] = useState(() => new Set(defaultFeatures));
  const [preferences, setPreferences] = useState<ReadingPreferences>(defaultPreferences);
  const [tocOpen, setTocOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const hasFeature = (id: string) => features.has(id);
  const tocEnabled = hasFeature('table-of-contents') && headings.length > 0;

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/plugins/active', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (response.ok && Array.isArray(json.data)) setFeatures(new Set(json.data.map((item: any) => item.id)));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    try {
      const legacy = JSON.parse(localStorage.getItem('boke-reading-settings-v1') || '{}');
      const saved = JSON.parse(localStorage.getItem('boke-book-reader-appearance') || '{}');
      setPreferences({
        theme: ['day', 'paper', 'eye', 'night', 'custom'].includes(saved.theme) ? saved.theme : 'day',
        fontSize: Math.max(14, Math.min(32, Number(saved.size || legacy.fontSize) || defaultPreferences.fontSize)),
        lineHeight: Math.max(1.4, Math.min(2.6, Number(saved.line || legacy.lineHeight) || defaultPreferences.lineHeight)),
        width: Math.max(560, Math.min(1040, Number(saved.width || legacy.width) || defaultPreferences.width)),
        margin: Math.max(12, Math.min(48, Number(saved.margin) || defaultPreferences.margin)),
        font: saved.font === 'sans-serif' ? 'sans-serif' : 'serif',
        background: /^#[0-9a-f]{6}$/i.test(saved.background) ? saved.background : defaultPreferences.background,
        focus: Boolean(legacy.focus),
      });
      if (hasFeature('article-bookmark')) {
        const bookmarks = JSON.parse(localStorage.getItem('boke-article-bookmarks-v1') || '[]');
        setBookmarked(Array.isArray(bookmarks) && bookmarks.some((item) => item.slug === article.slug));
      }
    } catch {}
  }, [article.slug, features]);

  useEffect(() => {
    document.body.classList.toggle('article-focus-mode', hasFeature('reading-mode') && preferences.focus);
    try {
      localStorage.setItem('boke-reading-settings-v1', JSON.stringify(preferences));
      const saved = JSON.parse(localStorage.getItem('boke-book-reader-appearance') || '{}');
      localStorage.setItem('boke-book-reader-appearance', JSON.stringify({
        ...saved,
        theme: preferences.theme,
        size: preferences.fontSize,
        line: preferences.lineHeight,
        width: preferences.width,
        margin: preferences.margin,
        font: preferences.font,
        background: preferences.background,
      }));
    } catch {}
    return () => document.body.classList.remove('article-focus-mode');
  }, [preferences, features]);

  useEffect(() => {
    progressRestored.current = false;
    let savedProgress = 0;
    try {
      const history = JSON.parse(localStorage.getItem('boke-reading-history-v1') || '[]');
      const saved = Array.isArray(history) ? history.find((item) => item.slug === article.slug) : null;
      savedProgress = Math.max(0, Math.min(1, Number(saved?.progress) || 0));
    } catch {}
    let restoreFrame = 0;
    const frame = requestAnimationFrame(() => {
      restoreFrame = requestAnimationFrame(() => {
        progressRestored.current = true;
        const maximum = document.documentElement.scrollHeight - window.innerHeight;
        if (savedProgress > 0 && savedProgress < .97 && maximum > 0) {
          window.scrollTo({ top: savedProgress * maximum, behavior: 'instant' });
        }
        setProgress(Math.round(savedProgress * 100));
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(restoreFrame);
    };
  }, [article.slug]);

  useEffect(() => {
    const update = () => {
      if (!progressRestored.current) return;
      const maximum = document.documentElement.scrollHeight - window.innerHeight;
      const value = maximum > 0 ? Math.min(1, Math.max(0, window.scrollY / maximum)) : 0;
      setProgress(Math.round(value * 100));
      if (hasFeature('reading-history')) try {
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
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [article.slug, article.title, features]);

  useEffect(() => {
    if (!hasFeature('code-copy') || !contentRef.current) return;
    const buttons: HTMLButtonElement[] = [];
    contentRef.current.querySelectorAll('pre').forEach((block) => {
      const source = block.querySelector('code')?.textContent || block.textContent || '';
      const button = document.createElement('button');
      button.className = 'article-code-copy';
      button.type = 'button';
      button.textContent = '复制代码';
      button.addEventListener('click', async () => {
        await navigator.clipboard.writeText(source);
        button.textContent = '已复制';
        window.setTimeout(() => { button.textContent = '复制代码'; }, 1200);
      });
      block.appendChild(button);
      buttons.push(button);
    });
    return () => buttons.forEach((button) => button.remove());
  }, [html, features]);

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

  const likeArticle = async () => {
    if (liked) return;
    try {
      const response = await fetch(`/api/articles/${article.id}/like`, { method: 'POST' });
      const json = await response.json();
      if (response.ok && json.data) {
        setLiked(Boolean(json.data.liked));
        setLikes(Number(json.data.like_count || likes));
      }
    } catch {}
  };

  const contentStyle = {
    '--reading-bg': ({ day: '#fafaf8', paper: '#f6efdc', eye: '#e9f1e8', night: '#1d211f', custom: preferences.background } as Record<string, string>)[preferences.theme] || '#fafaf8',
    '--reading-size': `${preferences.fontSize}px`,
    '--reading-line': String(preferences.lineHeight),
    '--reading-width': `${preferences.width}px`,
    '--reading-margin': `${preferences.margin}px`,
    '--reading-font': preferences.font,
    '--article-reader-size': `${preferences.fontSize}px`,
    '--article-reader-leading': String(preferences.lineHeight),
    '--article-reader-width': `${preferences.width}px`,
  } as CSSProperties;

  return (
    <div
      className="reading-workspace article-reader-workspace"
      data-theme={preferences.theme}
      data-controls={controlsOpen}
      data-focus={preferences.focus || undefined}
      style={contentStyle}
      onClick={(event) => {
        if (innerWidth > 760 || (event.target as HTMLElement).closest('a,button,input,select,dialog')) return;
        const x = event.clientX / innerWidth;
        if (x > .28 && x < .72) setControlsOpen((value) => !value);
      }}
    >
      {hasFeature('reading-progress') && <div className="article-reading-progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress / 100})` }} />
      </div>}
      <main className="reading-paper article-reading-main">
          <article className="article-content-card article-reader-paper">
            <header className="reading-heading article-content-head">
              <a href="/">← 返回文章</a>
              <div className="article-reader-meta">
                {article.category_name && <span className="badge badge-primary badge-outline">{article.category_name}</span>}
                {article.series_title && <a className="badge badge-secondary badge-outline" href={`/series/${encodeURIComponent(article.series_slug || '')}`}>专题 · {article.series_title}</a>}
                <span className="badge badge-ghost">{formatDate(article.published_at || article.created_at)}</span>
              </div>
              <h1>{article.title}</h1>
              <p className="article-reader-stats">
                {article.view_count || 0} 阅读 · {article.comment_count || 0} 评论
                {hasFeature('word-count') && <> · {wordCount} 字 · 约 {Math.max(1, Math.ceil(wordCount / 400))} 分钟</>}
                {hasFeature('article-like') && <> · {likes} 喜欢</>}
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

            <article ref={contentRef} className="markdown-body reading-prose article-restored-body" dangerouslySetInnerHTML={{ __html: html }} />
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
      </main>

      <aside className="reading-actions article-reader-actions" aria-label="文章阅读工具">
        {tocEnabled && <button type="button" onClick={() => setTocOpen(true)}><ToolIcon name="toc" /><span>目录</span></button>}
        {hasFeature('article-like') && <button className={liked ? 'is-liked' : ''} type="button" aria-pressed={liked} onClick={() => void likeArticle()}><ToolIcon name="like" /><span>{liked ? '已喜欢' : '喜欢'}</span></button>}
        {hasFeature('article-bookmark') && <button className={bookmarked ? 'is-bookmarked' : ''} type="button" aria-pressed={bookmarked} onClick={toggleBookmark}><ToolIcon name="bookmark" /><span>{bookmarked ? '已收藏' : '收藏'}</span></button>}
        <button type="button" onClick={() => void shareArticle()}><ToolIcon name="share" /><span>分享</span></button>
        {hasFeature('reading-mode') && <button type="button" onClick={() => settingsDialog.current?.showModal()}><ToolIcon name="reading" /><span>设置</span></button>}
        {hasFeature('back-to-top') && <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ToolIcon name="top" /><span>顶部</span></button>}
      </aside>

      <MobileReaderShell
        open={controlsOpen}
        onOpenChange={setControlsOpen}
        backHref="/"
        title={article.title}
        subtitle={article.category_name || '文章阅读'}
        progress={`${progress}%`}
        actions={[
          ...(tocEnabled ? [{ label: '目录', icon: '☰', onClick: () => setTocOpen(true) }] : []),
          ...(hasFeature('article-bookmark') ? [{ label: bookmarked ? '已收藏' : '收藏', icon: '☆', onClick: toggleBookmark }] : []),
          { label: '分享', icon: '↗', onClick: () => void shareArticle() },
          ...(hasFeature('reading-mode') ? [{ label: '设置', icon: 'Aa', primary: true, onClick: () => settingsDialog.current?.showModal() }] : []),
          { label: '顶部', icon: '↑', onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
        ]}
      />

      <button className="reading-catalog-scrim" type="button" hidden={!tocOpen} aria-label="关闭文章目录" onClick={() => setTocOpen(false)} />
      <aside className="reading-catalog" data-open={tocOpen} aria-label="文章目录">
        <header><div><small>{article.category_name || '文章'}</small><h2>文章目录</h2></div><button type="button" aria-label="关闭文章目录" onClick={() => setTocOpen(false)}>×</button></header>
        <nav>{headings.map((item, index) => <a className={`article-toc-link level-${item.level}`} href={`#${item.id}`} key={item.id} onClick={() => setTocOpen(false)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.text}</strong><small>H{item.level}</small></div></a>)}</nav>
      </aside>

      {hasFeature('reading-mode') && <dialog ref={settingsDialog} className="reading-settings" aria-labelledby="reading-settings-title">
        <form method="dialog">
          <header><h2 id="reading-settings-title">文章阅读设置</h2><button aria-label="关闭阅读设置">×</button></header>
          <label>字体<select value={preferences.font} onChange={(event) => setPreferences((value) => ({ ...value, font: event.target.value }))}><option value="serif">宋体 / 衬线</option><option value="sans-serif">黑体 / 无衬线</option></select></label>
          <label>字号 <output>{preferences.fontSize}px</output><input type="range" min="14" max="32" value={preferences.fontSize} onChange={(event) => setPreferences((value) => ({ ...value, fontSize: Number(event.target.value) }))} /></label>
          <label>行距 <output>{preferences.lineHeight.toFixed(1)}</output><input type="range" min="1.4" max="2.6" step=".1" value={preferences.lineHeight} onChange={(event) => setPreferences((value) => ({ ...value, lineHeight: Number(event.target.value) }))} /></label>
          <label>正文宽度 <output>{preferences.width}px</output><input type="range" min="560" max="1040" step="40" value={preferences.width} onChange={(event) => setPreferences((value) => ({ ...value, width: Number(event.target.value) }))} /></label>
          <label>页边距 <output>{preferences.margin}px</output><input type="range" min="12" max="48" step="2" value={preferences.margin} onChange={(event) => setPreferences((value) => ({ ...value, margin: Number(event.target.value) }))} /></label>
          <fieldset><legend>阅读背景</legend><div className="reading-themes">{Object.entries({ day: '日间', paper: '纸张', eye: '护眼', night: '夜间', custom: '自定义' }).map(([key, label]) => <button type="button" key={key} aria-pressed={preferences.theme === key} onClick={() => setPreferences((value) => ({ ...value, theme: key }))}>{label}</button>)}</div>{preferences.theme === 'custom' && <label>背景颜色<input type="color" value={preferences.background} onChange={(event) => setPreferences((value) => ({ ...value, background: event.target.value }))} /></label>}</fieldset>
          <label>专注模式 <input type="checkbox" checked={preferences.focus} onChange={(event) => setPreferences((value) => ({ ...value, focus: event.target.checked }))} /></label>
          <MobileReaderMusic />
          <footer><button type="button" onClick={() => setPreferences(defaultPreferences)}>恢复默认</button><button className="primary">完成</button></footer>
        </form>
      </dialog>}
    </div>
  );
}
