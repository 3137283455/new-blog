'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const href = (value: string) => encodeURIComponent(value);
const date = (value?: string) => value ? new Date(value).toLocaleDateString('zh-CN') : '未标注日期';
const media = (value?: string) => value || '';

type PublicPageSettings = {
  profile_name?: string;
  profile_avatar?: string;
  profile_bio?: string;
  site_title?: string;
  site_description?: string;
};

type SidebarMusicTrack = {
  id?: number;
  title: string;
  artist?: string;
  url: string;
  cover?: string;
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
  musicPlaylist = [],
  ariaLabel = '页面概览',
}: {
  settings?: PublicPageSettings;
  statItems?: SidebarStat[];
  totalPosts?: ReactNode;
  totalViews?: ReactNode;
  totalComments?: ReactNode;
  categories?: Array<string | { name?: string; slug?: string }>;
  sidebarSections?: SidebarSection[];
  musicPlaylist?: SidebarMusicTrack[];
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

  const tracks = musicPlaylist
    .filter((track) => track?.title && track?.url)
    .map((track) => ({ ...track, cover: track.cover || '/image2.webp' }));
  const musicPayload = JSON.stringify(tracks);

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
      <section className="ryu-card music-widget sidebar-music-card">
        <section className="music-player" data-music-player="" data-tracks={musicPayload}>
          <div className="music-player-cover">
            <img
              data-music-cover=""
              src={tracks[0]?.cover || '/image2.webp'}
              alt="音乐封面"
              loading="lazy"
            />
          </div>
          <div className="music-player-meta">
            <p className="music-player-kicker">全站音乐</p>
            <h3 data-music-title="">{tracks[0]?.title || '暂无音乐'}</h3>
            <p data-music-artist="">
              {tracks[0]?.artist || (tracks.length ? '未知歌手' : '请在后台音乐管理添加')}
            </p>
          </div>
          <audio data-music-audio="" src={tracks[0]?.url || undefined} preload="metadata" />
          <div className="music-player-time">
            <span data-music-current="">00:00</span>
            <span data-music-duration="">00:00</span>
          </div>
          <input
            className="music-player-range"
            data-music-seek=""
            type="range"
            min="0"
            max="1000"
            defaultValue="0"
            step="1"
            aria-label="播放进度"
          />
          <div className="music-player-actions">
            <button type="button" data-music-prev="" aria-label="上一首" title="上一首">
              ‹
            </button>
            <button type="button" data-music-toggle="" aria-label="播放或暂停" title="播放或暂停">
              <span data-music-toggle-icon="">▶</span>
            </button>
            <button type="button" data-music-next="" aria-label="下一首" title="下一首">
              ›
            </button>
            <a
              data-music-detail=""
              href={tracks[0] ? '/music/0' : '/admin'}
              aria-label="音乐详情"
              title="音乐详情"
            >
              详情
            </a>
          </div>
        </section>
      </section>
    </aside>
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
  tracks = [],
}: {
  articles: any[];
  series: any[];
  settings?: PublicPageSettings;
  tracks?: SidebarMusicTrack[];
}) {
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
  return <PublicPageLayout sidebar={<PublicSidebar settings={settings} totalPosts={articles.length} totalViews={totalViews} totalComments={totalComments} categories={categories} musicPlaylist={tracks} />}>
    <section className="home-utility" aria-label="快捷入口"><div className="home-utility-copy"><span className="section-number">01</span><p>今天想看点什么？</p></div><nav><a href="/archive"><span>浏览归档</span><small>{articles.length} 篇文章</small></a><a href="/search"><span>搜索内容</span><small>Ctrl / ⌘ K</small></a><a href="/nav"><span>网址导航</span><small>浏览器首页</small></a><a href="/admin/write"><span>开始写作</span><small>新建草稿</small></a></nav></section>
    {series.length > 0 && <section className="home-series"><header className="section-heading"><div><span className="section-number">S</span><div><p>Ongoing series</p><h2>持续更新的专题</h2></div></div><a href="/series">全部专题 <span>↗</span></a></header><div>{series.slice(0, 3).map((item, index) => <a key={item.id} href={`/series/${href(item.slug)}`}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{item.article_count || 0} 篇文章</small><h3>{item.title}</h3><p>{item.description || '持续记录中'}</p></div><b>↗</b></a>)}</div></section>}
    {featured && <article className="home-featured"><a href={`/article/${href(featured.slug)}`} className="home-featured-media"><img src={featured.cover_image || '/image1.webp'} alt="" /><span>本期推荐</span></a><div className="home-featured-content"><p className="article-kicker"><span>{featured.category_name || '随笔'}</span><time>{date(featured.published_at || featured.created_at)}</time></p><h2><a href={`/article/${href(featured.slug)}`}>{featured.title}</a></h2><p className="article-excerpt">{featured.excerpt || ''}</p><div className="article-footer"><span>约 {Math.max(1, Math.ceil(String(featured.excerpt || '').length / 320))} 分钟阅读</span><span>{featured.view_count || 0} 次浏览</span><a href={`/article/${href(featured.slug)}`}>继续阅读 <b>↗</b></a></div></div></article>}
    <section id="latest" className="home-latest"><header className="section-heading"><div><span className="section-number">02</span><div><p>Latest notes</p><h2>最近更新</h2></div></div><a href="/archive">查看全部 <span>↗</span></a></header><div className="home-post-grid">{regular.map((post, index) => <article key={post.id} className={`home-post${index === 0 ? ' is-wide' : ''}`}><a href={`/article/${href(post.slug)}`} className="home-post-cover"><img src={post.cover_image || `/image${(index % 3) + 1}.webp`} alt="" loading="lazy" /><span>{post.category_name || '随笔'}</span></a><div><p className="article-kicker"><time>{date(post.published_at || post.created_at)}</time></p><h3><a href={`/article/${href(post.slug)}`}>{post.title}</a></h3><p>{post.excerpt || ''}</p></div></article>)}</div>{!articles.length && <p className="empty-feature">还没有公开文章。</p>}</section>
  </PublicPageLayout>;
}

export function ArchivePage({ articles, category = '', settings = {}, tracks = [] }: { articles: any[]; category?: string; settings?: PublicPageSettings; tracks?: SidebarMusicTrack[] }) {
  const groups = useMemo(() => articles.reduce<Record<string, any[]>>((all, item) => { const year = new Date(item.published_at || item.created_at).getFullYear().toString(); (all[year] ||= []).push(item); return all; }, {}), [articles]);
  const yearEntries = Object.entries(groups).sort(([a], [b]) => Number(b) - Number(a));
  return <PublicPageLayout sidebar={<PublicSidebar settings={settings} statItems={[{ label: '文章', value: articles.length }, { label: '年份', value: yearEntries.length }, { label: '当前', value: category || '全部' }]} sidebarSections={[{ title: '归档视图', marker: '▣', tone: 'primary', items: yearEntries.map(([year, posts]) => ({ label: year, href: `#archive-year-${year}`, value: posts.length })) }]} musicPlaylist={tracks} />}><section className="archive-page"><header className="archive-hero"><p>ALL NOTES · {category || 'PUBLIC ARCHIVE'}</p><h1>归档</h1><span>{category ? `分类：${category}` : '按时间回看所有文章'}</span></header><div className="archive-list">{yearEntries.map(([year, posts]) => <section key={year} id={`archive-year-${year}`}><a href={`#archive-year-${year}`}><strong>{year}</strong><span>{posts.length} 篇</span></a><div>{posts.map((post) => <a key={post.id} href={`/article/${href(post.slug)}`}><span>{post.title}</span><time>{date(post.published_at || post.created_at)}</time></a>)}</div></section>)}{!articles.length && <p className="empty-feature">还没有符合条件的文章。</p>}</div></section></PublicPageLayout>;
}

export function SearchPage({ settings = {}, tracks = [] }: { settings?: PublicPageSettings; tracks?: SidebarMusicTrack[] }) {
  const [query, setQuery] = useState(''); const [results, setResults] = useState<any[]>([]); const [status, setStatus] = useState('输入关键词开始搜索');
  const search = async (value: string) => { setQuery(value); if (!value.trim()) { setResults([]); setStatus('输入关键词开始搜索'); return; } setStatus(`正在搜索“${value}”…`); try { const response = await fetch(`/api/search/all?q=${encodeURIComponent(value)}&limit=24`); const json = await response.json(); setResults(json.data?.results || []); setStatus(`找到 ${json.data?.total || 0} 条内容`); } catch { setStatus('搜索失败，请稍后重试'); } };
  return <PublicPageLayout sidebar={<PublicSidebar settings={settings} musicPlaylist={tracks} />}><div className="ryu-card search-workbench p-5"><header className="search-workbench-head"><div><p>DISCOVER</p><h2>找到想读的内容</h2></div><a href="/archive">浏览归档 ↗</a></header><label className="input input-bordered search-main-input flex items-center gap-2 rounded-2xl"><span aria-hidden="true">⌕</span><input autoFocus value={query} onChange={(event) => void search(event.target.value)} type="search" placeholder="输入关键词，搜索标题、正文、标签、分类..." autoComplete="off" /><kbd>/</kbd></label><div className="search-tools"><span>{status}</span></div><div className="mt-4 flex flex-col gap-3" aria-live="polite">{results.map((item) => <a className="ryu-card search-result search-result-wide block p-4 hover:text-primary" key={item.id} href={item.href}><div className="search-meta flex flex-wrap items-center gap-2 text-xs text-base-content/50"><span className="search-chip">{item.kind_label || '内容'}</span><span>{item.meta || ''}</span></div><h2 className="mt-2 text-xl font-black">{item.title}</h2><p className="mt-2 text-sm text-base-content/60">{item.subtitle || item.excerpt || ''}</p></a>)}</div></div></PublicPageLayout>;
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

export function SeriesPage({ series }: { series: any[] }) { return <section className="series-index"><header className="series-hero"><p>LONG-RUNNING STORIES</p><h1>专题与系列</h1><span>{series.length} 个持续更新的主题</span></header><div className="series-grid">{series.map((item, index) => <a key={item.id} href={`/series/${href(item.slug)}`} className="series-card"><div>{item.cover && <img src={media(item.cover)} alt="" loading="lazy" />}<span>{String(index + 1).padStart(2, '0')}</span></div><section><small>{item.series_type === 'book' ? '小说书籍' : item.series_type === 'project' ? '项目时间线' : '文章专题'} · {item.article_count || 0} 篇 · {item.total_views || 0} 阅读</small><h2>{item.title}</h2><p>{item.description || '这个专题正在持续记录中。'}</p><b>进入专题 ↗</b></section></a>)}</div>{!series.length && <div className="series-empty"><h2>第一个专题还在构思</h2><a href="/admin">去后台创建</a></div>}</section>; }

export function SeriesDetailPage({ series }: { series: any }) { return <article className={`series-detail${series.series_type === 'project' ? ' is-timeline' : ''}`}><header className="series-detail-hero"><div>{series.cover && <img src={media(series.cover)} alt="" />}</div><section><p>{series.series_type === 'project' ? 'PROJECT TIMELINE' : series.series_type === 'book' ? 'NOVEL BOOK' : 'ARTICLE COLLECTION'} · {series.article_count || 0} CHAPTERS</p><h1>{series.title}</h1><span>{series.description || '持续更新中的文章专题。'}</span>{series.linked_book && <a className="series-book-link" href={`/books/${href(series.linked_book.slug)}`}>打开独立书库版本 →</a>}</section></header><ol className="series-chapters">{(series.articles || []).map((item: any, index: number) => <li key={item.id}><a href={`/article/${href(item.slug)}`}><span>{String(index + 1).padStart(2, '0')}</span><div><h2>{item.title}</h2><p>{item.excerpt || '阅读这一章'}</p></div><small>{date(item.published_at || item.created_at)} · {item.view_count || 0} 阅读</small></a></li>)}</ol></article>; }

export function ArticlePage({ article }: { article: any }) { return <div className="article-reading-layout"><div className="article-reading-main"><article className="article-content-card ryu-card p-6 md:p-10"><header className="article-content-head mb-10 border-b border-base-content/10 pb-8 text-center"><div className="mb-4 flex flex-wrap justify-center gap-2"><span className="badge badge-primary badge-outline">{article.category_name || '随笔'}</span><span className="badge badge-ghost">{date(article.published_at || article.created_at)}</span></div><h1 className="mx-auto max-w-3xl text-4xl font-black leading-tight md:text-5xl">{article.title}</h1><p className="mt-4 text-sm text-base-content/50">{article.view_count || 0} 阅读 · {article.comment_count || 0} 评论</p></header><article className="markdown-body prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: article.content_html || `<p>${article.excerpt || ''}</p>` }} /></article><section className="article-discovery"><div className="article-neighbors">{article.previous ? <a href={`/article/${href(article.previous.slug)}`}><span>← 上一篇</span><strong>{article.previous.title}</strong></a> : <div />}{article.next && <a className="is-next" href={`/article/${href(article.next.slug)}`}><span>下一篇 →</span><strong>{article.next.title}</strong></a>}</div></section></div></div>; }

export function AlbumsPage({ albums, settings = {}, tracks = [] }: { albums: any[]; settings?: PublicPageSettings; tracks?: SidebarMusicTrack[] }) {
  const [query, setQuery] = useState('');
  const visible = albums.filter((item) => !query || `${item.title} ${item.description || ''} ${item.location || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const photoCount = albums.reduce((sum, album) => sum + (album.photos?.length || 0), 0);
  const locationItems = Array.from(new Set(albums.map((album) => album.location).filter(Boolean))).slice(0, 12).map((location) => ({ label: location, value: albums.filter((album) => album.location === location).length }));
  const yearItems = Array.from(new Set(albums.map((album) => album.event_date ? new Date(album.event_date).getFullYear().toString() : '').filter(Boolean))).slice(0, 12).map((year) => ({ label: year, value: albums.filter((album) => album.event_date && new Date(album.event_date).getFullYear().toString() === year).length }));
  return <PublicPageLayout sidebar={<PublicSidebar settings={settings} statItems={[{ label: '相册', value: albums.length }, { label: '照片', value: photoCount }, { label: '地点', value: new Set(albums.map((album) => album.location).filter(Boolean)).size }]} sidebarSections={[{ title: '拍摄地点', marker: '⌕', tone: 'primary', items: locationItems }, { title: '时间归档', marker: '●', tone: 'secondary', items: yearItems }]} musicPlaylist={tracks} />}><><section className="feature-toolbar ryu-card"><input value={query} onChange={(event) => setQuery(event.target.value)} className="input input-bordered rounded-xl" type="search" placeholder="搜索相册、描述、地点、日期..." /></section><section className="album-grid">{visible.map((album) => <a key={album.id} className="album-card ryu-card" href={`/albums/${album.id}`}><div className="album-body"><div className="album-title-row"><h2>{album.icon || ''} {album.title}</h2><span>{album.photos?.length || 0} 张</span></div><p>{album.description || '暂无描述'}</p><div className="album-meta"><span>{date(album.event_date)}</span><span>{album.location || '未标注地点'}</span></div></div><div className="album-polaroid-stage">{(album.photos || []).slice(0, 6).map((photo: any, index: number) => <span key={photo.id || index} className="album-polaroid" style={{ '--i': index, '--rotate': `${[-10, 7, -4, 10, -7, 4][index]}deg`, '--x': `${(index - 2.5) * 2.05}rem`, '--y': `${index % 2 === 0 ? .35 : 1.15}rem` } as React.CSSProperties}><img src={media(photo.image)} alt={photo.title || album.title} loading="lazy" /></span>)}</div></a>)}</section></></PublicPageLayout>;
}

export function AlbumDetailPage({ album, group = 'year', settings = {}, tracks = [] }: { album: any; group?: string; settings?: PublicPageSettings; tracks?: SidebarMusicTrack[] }) {
  const photos = album.photos || [];
  const groups = photos.reduce((all: Record<string, any[]>, photo: any) => { const value = photo.captured_at || album.event_date || photo.created_at || ''; const key = group === 'location' ? (photo.photo_location || album.location || '未标地点') : (value ? String(new Date(value).getFullYear()) : '未标日期'); (all[key] ||= []).push(photo); return all; }, {});
  return <PublicPageLayout sidebar={<PublicSidebar settings={settings} statItems={[{ label: '照片', value: photos.length }, { label: '地点', value: album.location || '未标注' }, { label: '日期', value: album.event_date ? date(album.event_date) : '未标注' }]} sidebarSections={[{ title: '相册信息', marker: '▧', tone: 'primary', items: [{ label: album.location || '未标注地点' }, { label: album.event_date ? date(album.event_date) : '未标注日期' }, { label: `${photos.length} 张照片` }] }]} musicPlaylist={tracks} />}><><section className="feature-toolbar ryu-card"><div><p className="feature-kicker">PHOTO WALL</p><h1>{album.icon || ''} {album.title}</h1><p>{album.description || '照片集'}</p></div><div className="album-view-actions"><a className="ryu-btn" href={`/albums/${album.id}?group=year`}>按年份</a><a className="ryu-btn" href={`/albums/${album.id}?group=location`}>按地点</a><a className="ryu-btn" href="/albums">返回相册</a></div></section><div className={`album-timeline${album.story_mode ? ' is-story-mode' : ''}`}>{(Object.entries(groups) as Array<[string, any[]]>).map(([key, items]) => <section className="album-year-group" key={key}><header><span>{key}</span><p>{items.length} 张照片</p></header><div className="photo-wall">{items.map((photo: any, index: number) => <a className={`photo-wall-item variant-${photo.variant || '1x1'}`} key={photo.id} href={media(photo.image)} target="_blank" rel="noopener noreferrer" style={{ '--rotate': `${[-2, 1.5, -1, 2.5, -1.5][index % 5]}deg` } as React.CSSProperties}><img src={media(photo.image)} alt={photo.title || album.title} loading="lazy" /><span><strong>{photo.title || '无题照片'}</strong><small>{photo.story_text || photo.description || '这一刻没有留下文字。'}</small></span></a>)}</div></section>)}</div></></PublicPageLayout>;
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
  tracks = [],
}: {
  items: any[];
  settings?: BangumiPageSettings;
  tracks?: SidebarMusicTrack[];
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
        musicPlaylist={tracks}
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


export function MemoriesPage({ insights, year }: { insights: any; year: number }) { const days = Array.from({ length: 365 }, (_, index) => { const d = new Date(); d.setDate(d.getDate() - (364 - index)); const key = d.toISOString().slice(0, 10); const item = (insights?.heatmap || []).find((entry: any) => entry.day === key); return { key, count: Number(item?.count || 0) }; }); const max = Math.max(1, ...days.map((item) => item.count)); return <main className="memory-report"><header className="memory-report-hero"><div><p>PERSONAL ARCHIVE</p><h1>{insights?.year || year} 年度回顾</h1><span>把零散记录重新连成时间线。</span></div><nav>{[0, 1, 2, 3, 4].map((offset) => <a key={offset} className={year === new Date().getFullYear() - offset ? 'is-active' : ''} href={`/memories?year=${new Date().getFullYear() - offset}`}>{new Date().getFullYear() - offset}</a>)}</nav></header><section className="memory-stat-grid"><article><small>年度文章</small><strong>{insights?.totals?.articles || 0}</strong><span>篇公开记录</span></article><article><small>写作字数</small><strong>{Number(insights?.totals?.words || 0).toLocaleString('zh-CN')}</strong><span>字</span></article><article><small>连续写作</small><strong>{insights?.streak?.current || 0}</strong><span>天 · 最长 {insights?.streak?.longest || 0} 天</span></article><article><small>本月回顾</small><strong>{insights?.current_month?.articles || 0}</strong><span>篇 · {insights?.current_month?.views || 0} 阅读</span></article></section><section className="memory-heatmap-card"><header><div><p>365 DAYS</p><h2>发布热力图</h2></div><span>颜色越深，记录越多</span></header><div className="memory-heatmap">{days.map((item) => <i key={item.key} title={`${item.key} · ${item.count} 篇`} style={{ '--heat': item.count / max } as React.CSSProperties} className={item.count ? 'has-post' : ''} />)}</div></section><div className="memory-report-columns"><section className="memory-months"><header><p>YEAR IN MONTHS</p><h2>月度写作</h2></header><div>{(insights?.months || []).map((month: any) => <article key={month.month}><span>{month.month} 月</span><i style={{ '--month-value': `${Math.min(100, Number(month.articles) * 14)}%` } as React.CSSProperties} /><strong>{month.articles} 篇</strong><small>{Number(month.words || 0).toLocaleString('zh-CN')} 字</small></article>)}</div></section><section className="memory-top-posts"><header><p>MOST READ</p><h2>年度文章</h2></header><ol>{(insights?.top_articles || []).map((article: any, index: number) => <li key={article.id}><a href={`/article/${href(article.slug)}`}><span>{index + 1}</span><strong>{article.title}</strong><small>{article.view_count || 0} 阅读</small></a></li>)}</ol></section></div></main>; }

export function MusicPage({ tracks }: { tracks: any[] }) { const [active, setActive] = useState(0); const track = tracks[active]; if (!track) return <div className="empty-feature">还没有音乐。</div>; return <section className="music-detail-hero"><img src={media(track.cover || '/home.webp')} alt="" /><div><p>MUSIC LIBRARY</p><h1>{track.title}</h1><span>{track.artist || '未知歌手'}</span><audio controls src={track.url} /></div><nav>{tracks.map((item, index) => <button key={item.id} type="button" onClick={() => setActive(index)} className={active === index ? 'is-active' : ''}>{item.title}</button>)}</nav></section>; }

export function PageContent({ page }: { page: any }) { return <article className="article-content-card ryu-card p-6 md:p-10"><header className="article-content-head mb-10 border-b border-base-content/10 pb-8 text-center"><h1 className="text-4xl font-black">{page.title}</h1></header><article className="markdown-body prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: page.content_html || `<p>${page.content || ''}</p>` }} /></article>; }
