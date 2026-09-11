'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EditorialHero } from '../../shared/site/editorial-hero';
import { ArticleReader } from './article-reader';
import { MusicRoom } from './music-room';
import { ensurePrivateDeviceToken } from '../../shared/device/private-device';

const href = (value: string) => encodeURIComponent(value);
const date = (value?: string) => value ? new Date(value).toLocaleDateString('zh-CN') : '未标注日期';
const media = (value?: string) => value || '';

type PublicPageSettings = {
  profile_name?: string;
  profile_avatar?: string;
  profile_bio?: string;
  site_title?: string;
  site_description?: string;
  banner_images?: string[] | string;
  banner_interval?: number;
};

type SidebarStat = { label: string; value: ReactNode };
type SidebarItem = { label: string; href?: string; value?: ReactNode };
type SidebarSection = {
  title: string;
  marker?: string;
  tone?: 'primary' | 'secondary' | 'accent';
  items: SidebarItem[];
};

function PublicSidebar({
  settings = {},
  statItems,
  totalPosts = 0,
  totalViews = 0,
  totalComments = 0,
  categories = [],
  sidebarSections,
  ariaLabel = '页面概览',
}: {
  settings?: PublicPageSettings;
  statItems?: SidebarStat[];
  totalPosts?: ReactNode;
  totalViews?: ReactNode;
  totalComments?: ReactNode;
  categories?: Array<string | { name?: string; slug?: string }>;
  sidebarSections?: SidebarSection[];
  ariaLabel?: string;
}) {
  const profileName = settings.profile_name || settings.site_title || '个人博客';
  const profileBio =
    settings.profile_bio || settings.site_description || '记录技术、生活和灵感的个人空间。';
  const profileStats = statItems?.length
    ? statItems.slice(0, 3)
    : [
        { label: '文章', value: totalPosts },
        { label: '阅读', value: totalViews },
        { label: '评论', value: totalComments },
      ];
  const categoryList = categories.length ? categories : ['技术', '生活', '随笔'];
  const sections: SidebarSection[] = sidebarSections ?? [
    {
      title: '分类',
      marker: '#',
      tone: 'primary' as const,
      items: categoryList.map((category) => {
        const name = typeof category === 'string' ? category : category.name || '';
        const slug = typeof category === 'string' ? category : category.slug || name;
        return { label: name, href: `/archive?category=${encodeURIComponent(slug)}` };
      }),
    },
    { title: '标签', marker: '✦', tone: 'secondary' as const, items: [] },
  ];

  return (
    <aside className="public-sidebar" aria-label={ariaLabel}>
      <section className="ryu-card sidebar-profile-card">
        <div className="sidebar-profile-head">
          <img
            src={settings.profile_avatar || '/profile.webp'}
              alt="个人头像"
              width="56"
              height="56"
              loading="lazy"
              decoding="async"
              data-fallback-src="/profile.webp"
            />
          <div>
            <h2>{profileName}</h2>
            <p>{profileBio}</p>
          </div>
        </div>
        <div className="sidebar-profile-stats">
          {profileStats.map((item) => (
            <div key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <div className="sidebar-context-sections">
          {sections.map(
            (section) =>
              section.items.length > 0 && (
                <section className="sidebar-context-section" key={section.title}>
                  <h3>
                    <span className={`text-${section.tone || 'primary'}`}>
                      {section.marker || '#'}
                    </span>{' '}
                    {section.title}
                  </h3>
                  <div>
                    {section.items.map((item) =>
                      item.href ? (
                        <a href={item.href} key={`${section.title}-${item.label}`}>
                          <span>{item.label}</span>
                          {item.value !== undefined && <small>{item.value}</small>}
                        </a>
                      ) : (
                        <span
                          className="sidebar-context-label"
                          key={`${section.title}-${item.label}`}
                        >
                          <span>{item.label}</span>
                          {item.value !== undefined && <small>{item.value}</small>}
                        </span>
                      ),
                    )}
                  </div>
                </section>
              ),
          )}
        </div>
      </section>
    </aside>
  );
}

function BannerPage({
  title,
  subtitle,
  settings = {},
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  settings?: PublicPageSettings;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <EditorialHero
        title={title}
        subtitle={subtitle}
        images={settings.banner_images}
        interval={settings.banner_interval}
      />
      <div
        className={`legacy-banner-page page-content-animate mx-auto mt-7 w-full ${wide ? 'max-w-wide' : 'max-w-blog'} px-4 pb-4`}
      >
        {children}
      </div>
    </>
  );
}

function PublicPageLayout({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar: ReactNode;
}) {
  return (
    <div className="public-page-layout">
      {sidebar}
      <div className="public-page-main">{children}</div>
    </div>
  );
}

export function HomePage({
  articles,
  series,
  settings = {},
}: {
  articles: any[];
  series: any[];
  settings?: PublicPageSettings;
}) {
  const [readingHistory, setReadingHistory] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [randomStatus, setRandomStatus] = useState('换一篇故事');
  const featured = articles.find((item) => item.is_pinned || item.is_recommended) || articles[0];
  const regular = articles.filter((item) => item.id !== featured?.id);
  const categories = Array.from(
    new Map(
      articles
        .filter((post) => post.category_name)
        .map((post) => [post.category_slug || post.category_name, { name: post.category_name, slug: post.category_slug || post.category_name }]),
    ).values(),
  );
  const totalViews = articles.reduce((sum, post) => sum + Number(post.view_count || 0), 0);
  const totalComments = articles.reduce((sum, post) => sum + Number(post.comment_count || 0), 0);
  const readingTime = (text = '') => Math.max(1, Math.ceil(text.length / 320));

  useEffect(() => {
    try {
      const historyValue = JSON.parse(localStorage.getItem('boke-reading-history-v1') || '[]');
      const bookmarkValue = JSON.parse(localStorage.getItem('boke-article-bookmarks-v1') || '[]');
      setReadingHistory(Array.isArray(historyValue) ? historyValue.slice(0, 4) : []);
      setBookmarks(Array.isArray(bookmarkValue) ? bookmarkValue.slice(0, 6) : []);
    } catch {}
  }, []);

  const randomArticle = async () => {
    setRandomStatus('正在寻找…');
    try {
      const response = await fetch('/api/articles/random', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.data?.slug) throw new Error(json.message || '暂时没有文章');
      window.location.href = `/article/${encodeURIComponent(json.data.slug)}`;
    } catch (error) {
      setRandomStatus(error instanceof Error ? error.message : '读取失败');
      window.setTimeout(() => setRandomStatus('换一篇故事'), 1800);
    }
  };

  return (
    <BannerPage title="个人博客" subtitle="记录技术、生活与灵感的个人空间" settings={settings}>
      <PublicPageLayout sidebar={<PublicSidebar settings={settings} totalPosts={articles.length} totalViews={totalViews} totalComments={totalComments} categories={categories} />}>
        <section className="home-utility" aria-label="快捷入口">
          <div className="home-utility-copy"><span className="section-number">01</span><p>今天想看点什么？</p></div>
          <nav>
            <a href="/archive"><span>浏览归档</span><small>{articles.length} 篇文章</small></a>
            <a href="/search"><span>搜索内容</span><small>Ctrl / ⌘ K</small></a>
            <a href="/nav"><span>网址导航</span><small>浏览器首页</small></a>
            <button type="button" onClick={() => void randomArticle()}><span>随机阅读</span><small>{randomStatus}</small></button>
            <a href="/admin/write"><span>开始写作</span><small>新建草稿</small></a>
          </nav>
        </section>

        {series.length > 0 && (
          <section className="home-series">
            <header className="section-heading"><div><span className="section-number">S</span><div><p>Ongoing series</p><h2>持续更新的专题</h2></div></div><a href="/series">全部专题 <span>↗</span></a></header>
            <div>{series.slice(0, 3).map((item, index) => <a key={item.id} href={`/series/${href(item.slug)}`}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{item.article_count || 0} 篇文章</small><h3>{item.title}</h3><p>{item.description || '持续记录中'}</p></div><b>↗</b></a>)}</div>
          </section>
        )}

        {readingHistory.length > 0 && (
          <section className="home-reading-history" aria-label="最近阅读">
            <header className="section-heading"><div><span className="section-number">↺</span><div><p>Continue reading</p><h2>最近阅读</h2></div></div><button type="button" onClick={() => { localStorage.removeItem('boke-reading-history-v1'); setReadingHistory([]); }}>清除记录</button></header>
            <div>{readingHistory.map((item) => { const value = Math.max(0, Math.min(100, Math.round(Number(item.progress || 0) * 100))); return <a href={`/article/${href(item.slug || '')}`} key={item.slug}><span className="home-reading-index">{item.completed ? '✓' : String(value).padStart(2, '0')}</span><span className="home-reading-copy"><strong>{item.title || '未命名文章'}</strong><small>{item.completed ? '再次阅读' : value > 0 ? '继续上次的位置' : '开始阅读'}</small></span><span className="home-reading-state"><b>{item.completed ? '已读完' : `${value}%`}</b><i style={{ '--reading-value': `${value}%` } as React.CSSProperties} /></span></a>; })}</div>
          </section>
        )}

        {bookmarks.length > 0 && (
          <section className="home-bookmarks" aria-label="我的收藏">
            <header className="section-heading"><div><span className="section-number">★</span><div><p>Saved stories</p><h2>我的收藏</h2></div></div><button type="button" onClick={() => { localStorage.removeItem('boke-article-bookmarks-v1'); setBookmarks([]); }}>清除收藏</button></header>
            <div>{bookmarks.map((item, index) => <a href={`/article/${href(item.slug || '')}`} key={item.slug}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.title || '未命名文章'}</strong><small>打开收藏 ↗</small></a>)}</div>
          </section>
        )}

        {featured && (
          <article className="home-featured">
            <a href={`/article/${href(featured.slug)}`} className="home-featured-media"><img src={featured.cover_image || '/image1.webp'} alt="" /><span>本期推荐</span></a>
            <div className="home-featured-content">
              <p className="article-kicker"><span>{featured.category_name || '随笔'}</span><time>{date(featured.published_at || featured.created_at)}</time></p>
              <h2><a href={`/article/${href(featured.slug)}`}>{featured.title}</a></h2>
              {featured.excerpt && <p className="article-excerpt">{featured.excerpt}</p>}
              <div className="article-footer"><span>{readingTime(`${featured.title}${featured.excerpt || ''}`)} 分钟阅读</span><span>{featured.view_count || 0} 次浏览</span><a href={`/article/${href(featured.slug)}`}>继续阅读 <b>↗</b></a></div>
            </div>
          </article>
        )}

        <section id="latest" className="home-latest">
          <header className="section-heading"><div><span className="section-number">02</span><div><p>Latest notes</p><h2>最近更新</h2></div></div><a href="/archive">查看全部 <span>↗</span></a></header>
          <div className="home-post-grid">{regular.map((post, index) => <article key={post.id} className="home-post"><a href={`/article/${href(post.slug)}`} className="home-post-cover"><img src={post.cover_image || `/image${((index + 1) % 3) + 1}.webp`} alt="" loading="lazy" decoding="async" /><span>{String(index + 1).padStart(2, '0')}</span></a><div className="home-post-body"><p className="article-kicker"><span>{post.category_name || '随笔'}</span><time>{date(post.published_at || post.created_at)}</time></p><h3><a href={`/article/${href(post.slug)}`}>{post.title}</a></h3>{post.excerpt && <p className="article-excerpt">{post.excerpt}</p>}<div className="article-footer"><span>{readingTime(`${post.title}${post.excerpt || ''}`)} 分钟</span><span>{post.view_count || 0} 浏览 · {post.comment_count || 0} 评论</span></div></div></article>)}</div>
          {!articles.length && <div className="home-empty"><span>空白页</span><h2>第一篇故事还在路上</h2><p>从一个念头开始，把它写下来。</p><a href="/admin/write">开始写作</a></div>}
        </section>
      </PublicPageLayout>
    </BannerPage>
  );
}

export function ArchivePage({ articles, category = '', settings = {} }: { articles: any[]; category?: string; settings?: PublicPageSettings }) {
  const groups = useMemo(() => articles.reduce<Record<string, any[]>>((all, item) => { const year = new Date(item.published_at || item.created_at).getFullYear().toString(); (all[year] ||= []).push(item); return all; }, {}), [articles]);
  const yearEntries = Object.entries(groups).sort(([a], [b]) => Number(b) - Number(a));
  return <BannerPage title="归档" subtitle={category ? `分类：${category}` : '按时间回看所有文章'} settings={settings}><PublicPageLayout sidebar={<PublicSidebar settings={settings} statItems={[{ label: '文章', value: articles.length }, { label: '年份', value: yearEntries.length }, { label: '当前', value: category || '全部' }]} sidebarSections={[{ title: '归档视图', marker: '▣', tone: 'primary', items: yearEntries.map(([year, posts]) => ({ label: year, href: `#archive-year-${year}`, value: posts.length })) }]} />}><section className="archive-page"><header className="archive-hero"><p>ALL NOTES · {category || 'PUBLIC ARCHIVE'}</p><h1>归档</h1><span>{category ? `分类：${category}` : '按时间回看所有文章'}</span></header><div className="archive-list">{yearEntries.map(([year, posts]) => <section key={year} id={`archive-year-${year}`}><a href={`#archive-year-${year}`}><strong>{year}</strong><span>{posts.length} 篇</span></a><div>{posts.map((post) => <a key={post.id} href={`/article/${href(post.slug)}`}><span>{post.title}</span><time>{date(post.published_at || post.created_at)}</time></a>)}</div></section>)}{!articles.length && <p className="empty-feature">还没有符合条件的文章。</p>}</div></section></PublicPageLayout></BannerPage>;
}

export function SearchPage({ settings = {} }: { settings?: PublicPageSettings }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('输入关键词开始搜索');
  const [loading, setLoading] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const kinds = [['', '全部内容'], ['article', '文章'], ['book', '书籍'], ['manga', '漫画'], ['bangumi', '追番'], ['album', '相册'], ['album-photo', '照片'], ['music', '音乐'], ['series', '专题']] as const;
  const search = async (value: string, nextPage = 1, nextKind = kind) => {
    if (!value.trim()) { setResults([]); setTotal(0); setPage(1); setStatus('输入关键词开始搜索'); return; }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setStatus(`正在搜索“${value}”…`);
    try {
      const params = new URLSearchParams({ q: value, limit: '24', page: String(nextPage) });
      if (nextKind) params.set('kind', nextKind);
      const response = await fetch(`/api/search/all?${params.toString()}`, { signal: controller.signal, cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || '搜索失败');
      const data = json.data || {};
      const nextResults = data.results || [];
      setResults((current) => nextPage === 1 ? nextResults : [...current, ...nextResults]);
      setTotal(Number(data.total || 0));
      setPage(nextPage);
      setStatus(`找到 ${Number(data.total || 0)} 条内容`);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setStatus('搜索失败，请稍后重试');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  const scheduleSearch = (value: string, nextKind = kind) => {
    setQuery(value);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void search(value, 1, nextKind), 180);
  };
  useEffect(() => () => { requestRef.current?.abort(); if (timerRef.current) window.clearTimeout(timerRef.current); }, []);
  return <BannerPage title="搜索" subtitle="搜索站内文章、书籍、漫画与相册" settings={settings}><PublicPageLayout sidebar={<PublicSidebar settings={settings} />}><div className="ryu-card search-workbench p-5"><header className="search-workbench-head"><div><p>DISCOVER</p><h2>找到想读的内容</h2></div><a href="/archive">浏览归档 ↗</a></header><label className="input input-bordered search-main-input flex items-center gap-2 rounded-2xl"><span aria-hidden="true">⌕</span><input autoFocus value={query} onChange={(event) => scheduleSearch(event.target.value)} type="search" placeholder="输入关键词，搜索标题、正文、标签、分类..." autoComplete="off" /><kbd>/</kbd></label><div className="search-tools"><div className="search-kind-filters" role="tablist" aria-label="搜索类型">{kinds.map(([value, label]) => <button key={value || 'all'} type="button" className={kind === value ? 'is-active' : ''} onClick={() => { setKind(value); void search(query, 1, value); }}>{label}</button>)}</div><span>{loading ? '搜索中…' : status}</span></div><div className="mt-4 flex flex-col gap-3" aria-live="polite">{results.map((item) => <a className="ryu-card search-result search-result-wide block p-4 hover:text-primary" key={item.id} href={item.href}><div className="search-meta flex flex-wrap items-center gap-2 text-xs text-base-content/50"><span className="search-chip">{item.kind_label || '内容'}</span><span>{item.meta || ''}</span></div><h2 className="mt-2 text-xl font-black">{item.title}</h2><p className="mt-2 text-sm text-base-content/60">{item.subtitle || item.excerpt || ''}</p></a>)}{query.trim() && !loading && !results.length && <div className="search-empty-state"><strong>没有找到匹配内容</strong><span>换个关键词或筛选类型再试。</span></div>}</div>{results.length < total && <button className="ryu-btn search-load-more" type="button" disabled={loading} onClick={() => void search(query, page + 1, kind)}>{loading ? '正在加载…' : `继续加载（还剩 ${total - results.length} 条）`}</button>}</div></PublicPageLayout></BannerPage>;
}

export function NavigationPage({ links }: { links: any[] }) {
  const [query, setQuery] = useState(''); const [favorite, setFavorite] = useState(false); const [favorites, setFavorites] = useState<number[]>([]);
  const favicon = (url: string) => {
    try {
      const target = new URL(url, 'https://boke.invalid');
      return target.protocol.startsWith('http')
        ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(target.hostname)}&sz=64`
        : '';
    } catch {
      return '';
    }
  };
  const categories = Array.from(new Set(links.map((item) => item.category || '常用')));
  const visible = links.filter((item) => (!query || `${item.title} ${item.description || ''} ${item.url}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) && (!favorite || favorites.includes(Number(item.id))));
  return <section className="start-page"><section className="bookmark-board"><header className="bookmark-toolbar"><div><p className="bookmark-eyebrow">YOUR BOOKMARKS</p><h2>常用站点 <span>{visible.length}</span></h2></div><label className="bookmark-filter"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="筛选站点" /><kbd>/</kbd></label><div className="bookmark-actions"><button type="button" className={favorite ? 'is-active' : ''} onClick={() => setFavorite(!favorite)}>☆ 收藏</button><a href="/admin">管理 ↗</a></div></header><div className="bookmark-categories"><button className="is-active" type="button">全部 <small>{links.length}</small></button>{categories.map((category) => <button key={category} type="button">{category} <small>{links.filter((item) => (item.category || '常用') === category).length}</small></button>)}</div><div className="bookmark-grid">{visible.map((item, index) => { const icon = item.avatar || favicon(item.url); return <article className="bookmark-card" key={item.id}><a className="bookmark-card-link" href={item.url} target={/^https?:/i.test(item.url) ? '_blank' : undefined} rel="noopener noreferrer"><span className="bookmark-icon">{icon && <img src={icon} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}<b>{item.icon || item.title?.slice(0, 1)}</b><kbd>{index + 1}</kbd></span><span className="bookmark-copy"><strong>{item.title}</strong><small>{item.description || item.url}</small></span><span className="bookmark-arrow">↗</span></a><button className="bookmark-star" type="button" onClick={() => setFavorites((state) => state.includes(Number(item.id)) ? state.filter((id) => id !== Number(item.id)) : [...state, Number(item.id)])}>☆</button><span className="bookmark-category">{item.category || '常用'}</span></article>; })}</div>{!visible.length && <div className="bookmark-empty"><strong>没有找到匹配的站点</strong><p>换个关键词或分类试试。</p></div>}</section><footer className="start-footer"><span>按 <kbd>/</kbd> 筛选站点</span><span>{links.length} 个站点 · 数据来自博客后台</span></footer></section>;
}

export function SeriesPage({ series, settings = {} }: { series: any[]; settings?: PublicPageSettings }) { return <BannerPage title="文章专题" subtitle="把持续记录的项目与兴趣整理成册" settings={settings}><section className="series-index"><header className="series-hero"><p>LONG-RUNNING STORIES</p><h1>专题与系列</h1><span>{series.length} 个持续更新的主题</span></header><div className="series-grid">{series.map((item, index) => <a key={item.id} href={`/series/${href(item.slug)}`} className="series-card"><div>{item.cover && <img src={media(item.cover)} alt="" loading="lazy" />}<span>{String(index + 1).padStart(2, '0')}</span></div><section><small>{item.series_type === 'book' ? '小说书籍' : item.series_type === 'project' ? '项目时间线' : '文章专题'} · {item.article_count || 0} 篇 · {item.total_views || 0} 阅读</small><h2>{item.title}</h2><p>{item.description || '这个专题正在持续记录中。'}</p><b>进入专题 ↗</b></section></a>)}</div>{!series.length && <div className="series-empty"><h2>第一个专题还在构思</h2><a href="/admin">去后台创建</a></div>}</section></BannerPage>; }

export function SeriesDetailPage({ series, settings = {} }: { series: any; settings?: PublicPageSettings }) { return <BannerPage title={series.title} subtitle={series.description || '文章专题'} settings={settings}><article className={`series-detail${series.series_type === 'project' ? ' is-timeline' : ''}`}><header className="series-detail-hero"><div>{series.cover && <img src={media(series.cover)} alt="" />}</div><section><p>{series.series_type === 'project' ? 'PROJECT TIMELINE' : series.series_type === 'book' ? 'NOVEL BOOK' : 'ARTICLE COLLECTION'} · {series.article_count || 0} CHAPTERS</p><h1>{series.title}</h1><span>{series.description || '持续更新中的文章专题。'}</span>{series.linked_book && <a className="series-book-link" href={`/books/${href(series.linked_book.slug)}`}>打开独立书库版本 →</a>}</section></header><ol className="series-chapters">{(series.articles || []).map((item: any, index: number) => <li key={item.id}><a href={`/article/${href(item.slug)}`}><span>{String(index + 1).padStart(2, '0')}</span><div><h2>{item.title}</h2><p>{item.excerpt || '阅读这一章'}</p></div><small>{date(item.published_at || item.created_at)} · {item.view_count || 0} 阅读</small></a></li>)}</ol></article></BannerPage>; }

export function ArticlePage({ article, settings = {} }: { article: any; settings?: PublicPageSettings }) {
  return <BannerPage title={article.title} subtitle={article.excerpt || ''} settings={settings} wide><ArticleReader article={article} /></BannerPage>;
}

type PendingAlbumPhoto = {
  id: string;
  file: File;
  preview: string;
  title: string;
  captured_at: string;
  description: string;
  photo_location: string;
};

async function albumRequest(url: string, init: RequestInit = {}) {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.message || json.error || '请求失败');
  return json.data;
}

function RelatedContentShelf({ items = [] }: { items?: any[] }) {
  if (!items.length) return null;
  const labels: Record<string, string> = { related: '相关内容', review: '观后感', adaptation: '改编作品', soundtrack: '背景音乐' };
  return <section className="related-content-shelf" aria-label="关联内容">
    <header><div><p>CONNECTED CONTENT</p><h2>关联内容</h2></div><span>{items.length} 项</span></header>
    <div>{items.map((item) => <a href={item.href} key={`related-${item.id}`}>
      <span className="related-content-cover">{item.image ? <img src={media(item.image)} alt="" loading="lazy" /> : <b>{item.kind_label?.slice(0, 1) || '·'}</b>}</span>
      <span><small>{labels[item.relation_type] || item.kind_label || '关联内容'}</small><strong>{item.title}</strong><em>{item.subtitle || item.meta || item.note || ''}</em></span>
      <b className="related-content-arrow">↗</b>
    </a>)}</div>
  </section>;
}

function AlbumUploadPanel({
  albums,
  albumId,
  onUploaded,
  onAlbumCreated,
}: {
  albums: any[];
  albumId?: number;
  onUploaded?: (photo: any) => void;
  onAlbumCreated?: (album: any) => void;
}) {
  const [token, setToken] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState(String(albumId || albums[0]?.id || ''));
  const [pending, setPending] = useState<PendingAlbumPhoto[]>([]);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    ensurePrivateDeviceToken('/api').then((value) => { if (active) setToken(value); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (albumId) setSelectedAlbumId(String(albumId));
  }, [albumId]);

  const addFiles = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name));
    if (!imageFiles.length) { setMessage('这里只接受图片文件'); return; }
    setOpen(true);
    setMessage('');
    setPending((current) => [...current, ...imageFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      title: file.name.replace(/\.[^.]+$/, '').slice(0, 100),
      captured_at: '',
      description: '',
      photo_location: '',
    }))]);
  };

  const removePending = (id: string) => setPending((current) => {
    const target = current.find((item) => item.id === id);
    if (target) URL.revokeObjectURL(target.preview);
    return current.filter((item) => item.id !== id);
  });

  const updatePending = (id: string, field: keyof PendingAlbumPhoto, value: string) => setPending((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));

  const createAlbum = async () => {
    if (!token) { setMessage('请先在“个人与同步”中登录此设备'); return; }
    if (!newAlbumTitle.trim()) { setMessage('请先填写相册名'); return; }
    setCreatingAlbum(true);
    try {
      const created = await albumRequest('/api/private/albums', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-Token': token }, body: JSON.stringify({ title: newAlbumTitle.trim() }) });
      setSelectedAlbumId(String(created.id));
      setNewAlbumTitle('');
      onAlbumCreated?.(created);
      setMessage('相册已创建，可以粘贴或选择图片');
    } catch (cause: any) { setMessage(cause.message || '相册创建失败'); }
    finally { setCreatingAlbum(false); }
  };

  const uploadPending = async (item: PendingAlbumPhoto) => {
    if (!token) throw new Error('请先在“个人与同步”中登录此设备');
    if (!selectedAlbumId) throw new Error('请先选择相册');
    if (!item.title.trim()) throw new Error('图片名不能为空');
    const body = new FormData();
    body.append('file', item.file, item.file.name);
    body.append('title', item.title.trim());
    body.append('captured_at', item.captured_at);
    body.append('description', item.description);
    body.append('photo_location', item.photo_location);
    return albumRequest(`/api/private/albums/${selectedAlbumId}/photos`, { method: 'POST', headers: { 'X-Device-Token': token }, body });
  };

  const confirmUpload = async () => {
    if (!pending.length) return;
    setBusy(true); setMessage('正在按确认顺序保存原图…');
    try {
      for (const item of pending) {
        const photo = await uploadPending(item);
        onUploaded?.(photo);
        URL.revokeObjectURL(item.preview);
      }
      setPending([]); setMessage('全部照片已导入，原图未压缩');
    } catch (cause: any) { setMessage(cause.message || '导入失败，已保留未完成队列'); }
    finally { setBusy(false); }
  };

  if (!token) return null;

  return <section className={`album-upload-panel ryu-card${open ? ' is-open' : ''}`} onPaste={(event) => {
    const files = Array.from(event.clipboardData.files || []);
    if (files.length) { event.preventDefault(); addFiles(files); }
  }}>
    <button className="album-upload-toggle" type="button" onClick={() => setOpen((value) => !value)}><span><b>＋ 导入照片</b><small>已验证设备 · 支持粘贴截图</small></span><i>{open ? '收起' : '打开'}</i></button>
    {open && <div className="album-upload-content">
      {!albumId && <div className="album-upload-row"><select className="select select-bordered" value={selectedAlbumId} onChange={(event) => setSelectedAlbumId(event.target.value)}><option value="">选择目标相册</option>{albums.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select><input className="input input-bordered" value={newAlbumTitle} onChange={(event) => setNewAlbumTitle(event.target.value)} placeholder="或新建相册" /><button type="button" className="ryu-btn is-primary" onClick={createAlbum} disabled={creatingAlbum}>{creatingAlbum ? '创建中…' : '新建相册'}</button></div>}
      <div className="album-dropzone" tabIndex={0} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }}><input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/heic,image/heif" multiple onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.currentTarget.value = ''; }} /><strong>点击选择 / 拖拽图片 / Ctrl+V 粘贴截图</strong><span>导入前可以逐张修改名称、时间、地点和说明</span></div>
      {pending.length > 0 && <div className="album-pending-list">{pending.map((item) => <article className="album-pending-item" key={item.id}><img src={item.preview} alt="待确认图片" /><div className="album-pending-fields"><input className="input input-bordered" value={item.title} onChange={(event) => updatePending(item.id, 'title', event.target.value)} placeholder="图片名" /><input className="input input-bordered" type="datetime-local" value={item.captured_at ? item.captured_at.slice(0, 16) : ''} onChange={(event) => updatePending(item.id, 'captured_at', event.target.value)} /><input className="input input-bordered" value={item.photo_location} onChange={(event) => updatePending(item.id, 'photo_location', event.target.value)} placeholder="地点（可选）" /><textarea className="textarea textarea-bordered" value={item.description} onChange={(event) => updatePending(item.id, 'description', event.target.value)} placeholder="图片说明（可选）" /></div><button type="button" className="ryu-btn is-ghost" onClick={() => removePending(item.id)}>移出</button></article>)}</div>}
      <div className="album-upload-footer"><span>{message || '图片只在点击确认后上传，原图不压缩'}</span>{pending.length > 0 && <button type="button" className="ryu-btn is-primary" onClick={confirmUpload} disabled={busy || !selectedAlbumId}>{busy ? '导入中…' : `确认导入 ${pending.length} 张`}</button>}</div>
    </div>}
  </section>;
}

export function AlbumsPage({ albums, settings = {} }: { albums: any[]; settings?: PublicPageSettings }) {
  const [query, setQuery] = useState('');
  const [liveAlbums, setLiveAlbums] = useState(albums);
  const visible = liveAlbums.filter((item) => !query || `${item.title} ${item.description || ''} ${item.location || ''} ${item.event_date || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const photoCount = liveAlbums.reduce((sum, album) => sum + (album.photos?.length || 0), 0);
  const locationItems = Array.from(new Set(liveAlbums.map((album) => album.location).filter(Boolean))).slice(0, 12).map((location) => ({ label: location, value: liveAlbums.filter((album) => album.location === location).length }));
  const yearItems = Array.from(new Set(liveAlbums.map((album) => album.album_time || album.latest_photo_at || album.event_date).filter(Boolean).map((value) => new Date(value).getFullYear().toString()))).slice(0, 12).map((year) => ({ label: year, value: liveAlbums.filter((album) => String(new Date(album.album_time || album.latest_photo_at || album.event_date).getFullYear()) === year).length }));
  const refreshAlbum = async () => { try { setLiveAlbums((await albumRequest('/api/albums')) || []); } catch { /* public refresh is best effort */ } };
  return <BannerPage title="相册" subtitle="记录生活里的画面和回忆" settings={settings}>
    <PublicPageLayout sidebar={<PublicSidebar settings={settings} statItems={[{ label: '相册', value: liveAlbums.length }, { label: '照片', value: photoCount }, { label: '地点', value: new Set(liveAlbums.map((album) => album.location).filter(Boolean)).size }]} sidebarSections={[{ title: '拍摄地点', marker: '⌕', tone: 'primary', items: locationItems }, { title: '时间归档', marker: '●', tone: 'secondary', items: yearItems }]} />}>
      <>
        <AlbumUploadPanel albums={liveAlbums} onUploaded={refreshAlbum} onAlbumCreated={refreshAlbum} />
        <section className="album-index-toolbar">
          <div><p>PHOTO ARCHIVE</p><h1>全部相册</h1><span>{liveAlbums.length} 册 · {photoCount} 张照片</span></div>
          <label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="搜索相册、地点或日期" /></label>
        </section>
        <section className="album-showcase-grid">
          {visible.map((album, albumIndex) => {
            const photos = album.photos || [];
            const leadImage = album.cover || photos[0]?.preview_image || photos[0]?.image || '';
            const sidePhotos = photos.slice(album.cover ? 0 : 1, album.cover ? 2 : 3);
            return <a key={album.id} className="album-showcase-card" href={`/albums/${album.id}`}>
              <div className={`album-showcase-collage${sidePhotos.length ? ' has-side' : ''}`}>
                <span className="album-showcase-lead">{leadImage ? <img src={media(leadImage)} alt="" loading="lazy" decoding="async" /> : <b>{album.icon || '相'}</b>}</span>
                {sidePhotos.map((photo: any) => <span key={photo.id}><img src={media(photo.preview_image || photo.image)} alt="" loading="lazy" decoding="async" /></span>)}
                <i>{String(albumIndex + 1).padStart(2, '0')}</i>
              </div>
              <div className="album-showcase-copy">
                <p><time>{date(album.album_time || album.latest_photo_at || album.event_date || album.created_at)}</time><span>{photos.length} 张</span></p>
                <h2>{album.icon && <em>{album.icon}</em>}{album.title}</h2>
                <div>{album.description || '这一册还没有写下说明。'}</div>
                <footer><span>{album.location || '未标注地点'}</span><b>打开相册 ↗</b></footer>
              </div>
            </a>;
          })}
          {!visible.length && <div className="album-index-empty"><strong>{query ? '没有找到匹配的相册' : '还没有相册'}</strong><span>{query ? '换个关键词试试。' : '登录过的设备可以从这里创建第一册。'}</span></div>}
        </section>
      </>
    </PublicPageLayout>
  </BannerPage>;
}

export function AlbumDetailPage({ album, group = 'year', settings = {} }: { album: any; group?: string; settings?: PublicPageSettings }) {
  const [liveAlbum, setLiveAlbum] = useState(album);
  useEffect(() => setLiveAlbum(album), [album]);
  const photos = liveAlbum.photos || [];
  const groups = photos.reduce((all: Record<string, any[]>, photo: any) => { const value = photo.captured_at || liveAlbum.event_date || photo.created_at || ''; const key = group === 'location' ? (photo.photo_location || liveAlbum.location || '未标地点') : (value ? String(new Date(value).getFullYear()) : '未标日期'); (all[key] ||= []).push(photo); return all; }, {});
  useEffect(() => { if (globalThis.location.hash) document.getElementById(globalThis.location.hash.slice(1))?.scrollIntoView({ block: 'center' }); }, [photos.length]);
  const refreshAlbum = async () => { try { setLiveAlbum(await albumRequest(`/api/albums/${liveAlbum.id}`)); } catch { /* public refresh is best effort */ } };
  return <BannerPage title={liveAlbum.title} subtitle={liveAlbum.description || '照片集'} settings={settings}><PublicPageLayout sidebar={<PublicSidebar settings={settings} statItems={[{ label: '照片', value: photos.length }, { label: '地点', value: liveAlbum.location || '未标注' }, { label: '日期', value: date(liveAlbum.album_time || liveAlbum.latest_photo_at || liveAlbum.event_date || liveAlbum.created_at) }]} sidebarSections={[{ title: '相册信息', marker: '▧', tone: 'primary', items: [{ label: liveAlbum.location || '未标注地点' }, { label: date(liveAlbum.album_time || liveAlbum.latest_photo_at || liveAlbum.event_date || liveAlbum.created_at) }, { label: `${photos.length} 张照片` }] }]} />}><><AlbumUploadPanel albums={[liveAlbum]} albumId={liveAlbum.id} onUploaded={refreshAlbum} /><section className="feature-toolbar ryu-card"><div><p className="feature-kicker">PHOTO WALL</p><h1>{liveAlbum.icon || ''} {liveAlbum.title}</h1><p>{liveAlbum.description || '照片集'}</p></div><div className="album-view-actions"><a className="ryu-btn" href={`/albums/${liveAlbum.id}?group=year`}>按年份</a><a className="ryu-btn" href={`/albums/${liveAlbum.id}?group=location`}>按地点</a><a className="ryu-btn" href="/albums">返回相册</a></div></section><div className={`album-timeline${liveAlbum.story_mode ? ' is-story-mode' : ''}`}>{(Object.entries(groups) as Array<[string, any[]]>).map(([key, items]) => <section className="album-year-group" key={key}><header><span>{key}</span><p>{items.length} 张照片</p></header><div className="photo-wall">{items.map((photo: any, index: number) => <a id={`photo-${photo.id}`} className={`photo-wall-item variant-${photo.variant || '1x1'}`} key={photo.id} href={media(photo.image)} target="_blank" rel="noopener noreferrer" style={{ '--rotate': `${[-2, 1.5, -1, 2.5, -1.5][index % 5]}deg` } as React.CSSProperties}><img src={media(photo.preview_image || photo.image)} alt={photo.title || liveAlbum.title} loading="lazy" /><span><strong>{photo.title || photo.display_name || '无题照片'}</strong><small>{photo.story_text || photo.description || '这一刻没有留下文字。'}</small></span></a>)}</div></section>)}</div><RelatedContentShelf items={liveAlbum.custom_relations} /></></PublicPageLayout></BannerPage>;
}

const bangumiStatusLabels: Record<string, string> = {
  watching: '追番中',
  done: '已看完',
  plan: '想看',
  planned: '想看',
  paused: '搁置',
  dropped: '弃番',
};

type BangumiPlaySource = {
  name?: string;
  url?: string;
  remark?: string;
  is_default?: boolean | number;
  sort_order?: number;
};

const normalizeExternalUrl = (value: unknown) => {
  const url = String(value || '').trim();
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/+/, '')}`;
};

function parseBangumiPlaySources(item: any): BangumiPlaySource[] {
  const direct = item.play_sources;
  if (Array.isArray(direct)) return sortBangumiPlaySources(direct);
  if (Array.isArray(item.play_links)) return sortBangumiPlaySources(item.play_links);
  try {
    const parsed = JSON.parse(String(item.play_links || '[]'));
    return Array.isArray(parsed) ? sortBangumiPlaySources(parsed) : [];
  } catch {
    return [];
  }
}

function sortBangumiPlaySources(sources: BangumiPlaySource[]) {
  return sources
    .filter((source) => source?.url)
    .sort((a, b) => {
      const defaultDiff = Number(Boolean(b.is_default)) - Number(Boolean(a.is_default));
      return defaultDiff || Number(a.sort_order || 0) - Number(b.sort_order || 0);
    });
}

function bangumiDetailUrl(item: any) {
  const externalId = String(item.external_id || '').trim();
  if (externalId) return `https://bangumi.lol/subject/${encodeURIComponent(externalId)}`;
  const subjectId = String(item.url || '').match(/\/subject\/(\d+)/)?.[1];
  return subjectId ? `https://bangumi.lol/subject/${subjectId}` : normalizeExternalUrl(item.url);
}

type BangumiPageSettings = PublicPageSettings;

export function BangumiPage({
  items,
  settings = {},
}: {
  items: any[];
  settings?: BangumiPageSettings;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sourceDialog, setSourceDialog] = useState<{
    title: string;
    sources: BangumiPlaySource[];
  } | null>(null);
  const sourceDialogRef = useRef<HTMLDialogElement>(null);
  const scoredItems = items.filter((item) => Number(item.rating || 0) > 0);
  const averageRating = scoredItems.length
    ? scoredItems.reduce((sum, item) => sum + Number(item.rating || 0), 0) / scoredItems.length
    : 0;
  const sidebarStatuses = Object.entries(bangumiStatusLabels)
    .filter(
      ([status], index, rows) =>
        rows.findIndex(([, label]) => label === bangumiStatusLabels[status]) === index,
    )
    .map(([status, label]) => ({
      label,
      value: items.filter((item) => (item.status || 'watching') === status).length,
    }))
    .filter((item) => Number(item.value) > 0);
  const sidebarSeasons = Array.from(new Set(items.map((item) => item.season).filter(Boolean)))
    .slice(0, 10)
    .map((season) => ({
      label: String(season),
      value: items.filter((item) => item.season === season).length,
    }));
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !needle ||
        `${item.title} ${item.original_title || ''} ${item.summary || ''} ${item.season || ''}`
          .toLocaleLowerCase()
          .includes(needle);
      return matchesQuery && (!status || (item.status || 'watching') === status);
    });
  }, [items, query, status]);
  useEffect(() => {
    const dialog = sourceDialogRef.current;
    if (!dialog) return;
    if (sourceDialog && !dialog.open) dialog.showModal();
    if (!sourceDialog && dialog.open) dialog.close();
  }, [sourceDialog]);

  return (
    <div className="bangumi-page-layout">
      <PublicSidebar
        settings={settings}
        ariaLabel="追番概览"
        statItems={[
          { label: '总追番', value: items.length },
          { label: '追番中', value: items.filter((item) => item.status === 'watching').length },
          { label: '已看完', value: items.filter((item) => item.status === 'done').length },
        ]}
        sidebarSections={[
          { title: '追番状态', marker: '#', tone: 'primary', items: sidebarStatuses },
          { title: '季度', marker: '◇', tone: 'secondary', items: sidebarSeasons },
        ]}
      />

      <div className="bangumi-page-main">
        <section className="bangumi-compact-head">
          <div>
            <p>Bangumi Collection</p>
            <h1>追番列表</h1>
          </div>
          <div className="bangumi-compact-stats">
            <span>
              <strong>{items.length}</strong> 部作品
            </span>
            <span>
              <strong>{averageRating.toFixed(1)}</strong> 平均评分
            </span>
          </div>
        </section>
        <section className="feature-toolbar bangumi-filterbar ryu-card">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input input-bordered rounded-xl"
            type="search"
            placeholder="搜索番剧、简介或季度..."
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="select select-bordered rounded-xl"
            aria-label="按追番状态筛选"
          >
            <option value="">全部状态</option>
            <option value="watching">追番中</option>
            <option value="done">已看完</option>
            <option value="plan">想看</option>
            <option value="paused">搁置</option>
            <option value="dropped">弃番</option>
          </select>
        </section>
        <section className="bangumi-grid bangumi-grid-compact">
          {visible.map((item) => {
            const sources = parseBangumiPlaySources(item);
            const defaultSource = sources.find((source) => Boolean(source.is_default));
            const defaultUrl = normalizeExternalUrl(defaultSource?.url);
            const detailUrl = bangumiDetailUrl(item);
            const rating = Number(item.rating || 0);
            const cardContent = (
              <>
                <div className="bangumi-cover">
                  {item.cover ? (
                    <img src={media(item.cover)} alt={item.title} loading="lazy" />
                  ) : (
                    <span>暂无封面</span>
                  )}
                  <b>{bangumiStatusLabels[item.status || 'watching'] || item.status || '追番中'}</b>
                  {rating > 0 && <em>★ {rating.toFixed(1)}</em>}
                  {defaultUrl && <i>▶</i>}
                </div>
                <div className="bangumi-info">
                  <h2 title={item.title}>{item.title}</h2>
                  <p>{item.original_title || item.season || '未标注季度'}</p>
                </div>
              </>
            );
            return (
              <article className="bangumi-card bangumi-card-compact" key={item.id}>
                {defaultUrl ? (
                  <a
                    className="bangumi-card-main"
                    href={defaultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`使用默认播放源：${defaultSource?.name || '播放源'}`}
                  >
                    {cardContent}
                  </a>
                ) : (
                  <div className="bangumi-card-main">{cardContent}</div>
                )}
                <div className="bangumi-card-footer">
                  {item.article_slug ? (
                    <a href={`/article/${href(item.article_slug)}`}>
                      <small>观后感</small>
                      <strong>阅读</strong>
                    </a>
                  ) : (
                    <span>
                      <small>观后感</small>
                      <strong>未关联</strong>
                    </span>
                  )}
                  {detailUrl ? (
                    <a href={detailUrl} target="_blank" rel="noopener noreferrer">
                      <small>详情</small>
                      <strong>查看</strong>
                    </a>
                  ) : (
                    <span>
                      <small>详情</small>
                      <strong>未知</strong>
                    </span>
                  )}
                  {sources.length ? (
                    <button
                      type="button"
                      onClick={() => setSourceDialog({ title: item.title, sources })}
                    >
                      <small>播放源</small>
                      <strong>选择</strong>
                    </button>
                  ) : (
                    <span>
                      <small>播放源</small>
                      <strong>未知</strong>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
        <div className="feature-empty" hidden={visible.length > 0}>
          <strong>{items.length ? '没有匹配的番剧' : '暂无追番数据'}</strong>
          <span>
            {items.length ? '换个关键词或状态再试。' : '请先在后台内容中心添加并启用番剧。'}
          </span>
        </div>
      </div>

      {sourceDialog && (
        <dialog
          ref={sourceDialogRef}
          className="bangumi-play-dialog"
          aria-labelledby="bangumi-play-dialog-title"
          onClose={() => setSourceDialog(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSourceDialog(null);
          }}
        >
          <div className="bangumi-play-dialog-panel">
            <header>
              <div>
                <p>播放源</p>
                <h2 id="bangumi-play-dialog-title">{sourceDialog.title}</h2>
              </div>
              <button
                className="admin-dialog-close"
                type="button"
                aria-label="关闭"
                title="关闭"
                onClick={() => sourceDialogRef.current?.close()}
              >
                ×
              </button>
            </header>
            <div className="bangumi-play-dialog-list">
              {sourceDialog.sources.map((source, index) => {
                const url = normalizeExternalUrl(source.url);
                return (
                  <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer">
                    <span>
                      <strong>{source.name || '播放源'}</strong>
                      {source.is_default && <b>默认</b>}
                      {source.remark && <small>{source.remark}</small>}
                    </span>
                    <code>{url}</code>
                    <i>↗</i>
                  </a>
                );
              })}
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}


export function MemoriesPage({ insights, year, settings = {} }: { insights: any; year: number; settings?: PublicPageSettings }) { const days = Array.from({ length: 365 }, (_, index) => { const d = new Date(); d.setDate(d.getDate() - (364 - index)); const key = d.toISOString().slice(0, 10); const item = (insights?.heatmap || []).find((entry: any) => entry.day === key); return { key, count: Number(item?.count || 0) }; }); const max = Math.max(1, ...days.map((item) => item.count)); return <BannerPage title="个人回忆" subtitle="写作、照片与时间留下的长期记录" settings={settings}><main className="memory-report"><header className="memory-report-hero"><div><p>PERSONAL ARCHIVE</p><h1>{insights?.year || year} 年度回顾</h1><span>把零散记录重新连成时间线。</span></div><nav>{[0, 1, 2, 3, 4].map((offset) => <a key={offset} className={year === new Date().getFullYear() - offset ? 'is-active' : ''} href={`/memories?year=${new Date().getFullYear() - offset}`}>{new Date().getFullYear() - offset}</a>)}</nav></header><section className="memory-stat-grid"><article><small>年度文章</small><strong>{insights?.totals?.articles || 0}</strong><span>篇公开记录</span></article><article><small>写作字数</small><strong>{Number(insights?.totals?.words || 0).toLocaleString('zh-CN')}</strong><span>字</span></article><article><small>连续写作</small><strong>{insights?.streak?.current || 0}</strong><span>天 · 最长 {insights?.streak?.longest || 0} 天</span></article><article><small>本月回顾</small><strong>{insights?.current_month?.articles || 0}</strong><span>篇 · {insights?.current_month?.views || 0} 阅读</span></article></section><section className="memory-heatmap-card"><header><div><p>365 DAYS</p><h2>发布热力图</h2></div><span>颜色越深，记录越多</span></header><div className="memory-heatmap">{days.map((item) => <i key={item.key} title={`${item.key} · ${item.count} 篇`} style={{ '--heat': item.count / max } as React.CSSProperties} className={item.count ? 'has-post' : ''} />)}</div></section><div className="memory-report-columns"><section className="memory-months"><header><p>YEAR IN MONTHS</p><h2>月度写作</h2></header><div>{(insights?.months || []).map((month: any) => <article key={month.month}><span>{month.month} 月</span><i style={{ '--month-value': `${Math.min(100, Number(month.articles) * 14)}%` } as React.CSSProperties} /><strong>{month.articles} 篇</strong><small>{Number(month.words || 0).toLocaleString('zh-CN')} 字</small></article>)}</div></section><section className="memory-top-posts"><header><p>MOST READ</p><h2>年度文章</h2></header><ol>{(insights?.top_articles || []).map((article: any, index: number) => <li key={article.id}><a href={`/article/${href(article.slug)}`}><span>{index + 1}</span><strong>{article.title}</strong><small>{article.view_count || 0} 阅读</small></a></li>)}</ol></section></div></main></BannerPage>; }

export function MusicPage({ tracks, index = 0, settings = {} }: { tracks: any[]; index?: number; settings?: PublicPageSettings }) {
  return <MusicRoom tracks={tracks} initialIndex={index} settings={settings} />;
}

export function PageContent({ page, settings = {} }: { page: any; settings?: PublicPageSettings }) { return <BannerPage title={page.title} subtitle="自定义独立页面" settings={settings}><article className="article-content-card ryu-card p-6 md:p-10"><header className="article-content-head mb-10 border-b border-base-content/10 pb-8 text-center"><h1 className="text-4xl font-black">{page.title}</h1></header><article className="markdown-body prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: page.content_html || `<p>${page.content || ''}</p>` }} /></article></BannerPage>; }
