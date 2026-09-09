import { MangaSiteHeader } from './site-header';
import { CollectionActions } from './collection-actions';
import { sourceChapterHref, type SourceDetail, type SourceKind } from '../source-detail';

export function SourceDetailPage({
  kind,
  source,
  id,
  data,
}: {
  kind: SourceKind;
  source: string;
  id: string;
  data: SourceDetail;
}) {
  const item = data.item;
  const sourceMeta = data.source;
  const chapters = Array.isArray(data.chapters) ? data.chapters : [];
  const home = kind === 'book' ? '/books' : kind === 'manga' ? '/manga' : '/bangumi';
  const titleLabel = kind === 'book' ? '小说' : kind === 'manga' ? '漫画' : '番剧';
  const chapterHref = (chapter: SourceDetail['chapters'][number]) =>
    sourceChapterHref(kind, source, id, chapter, data.can_read);
  return (
    <div className={`manga-source-shell manga-redesign manga-source-shell-${kind}`}>
      {kind === 'manga' && <MangaSiteHeader active="discover" backHref="/manga" />}
      <div className="manga-source-layout">
        <aside className="manga-context-rail manga-source-context" aria-label={`${titleLabel}来源信息`}>
          <div className="manga-context-intro">
            <p>{sourceMeta.label} · SOURCE</p>
            <h2>作品<br />档案</h2>
            <span>从来源详情进入章节，或返回你的{titleLabel}空间。</span>
          </div>
          <nav className="manga-context-nav" aria-label="返回入口">
            <a href={home}><span>01</span>返回{titleLabel}架</a>
            {kind === 'manga' && <a href="/manga/search"><span>02</span>搜索漫画</a>}
            {kind === 'manga' && <a href="/manga/library"><span>03</span>我的书架</a>}
          </nav>
          <section className="manga-context-status">
            <p>READING ACCESS</p>
            <strong>{data.can_read ? '站内阅读' : '源站阅读'}</strong>
            <span>{chapters.length ? `${chapters.length} 个章节可用` : '等待来源提供目录接口'}</span>
          </section>
          <a className="manga-context-footer" href={item.source_url || home} target={item.source_url ? '_blank' : undefined} rel={item.source_url ? 'noopener noreferrer' : undefined}>
            <span>来源页面</span><small>{item.source_url ? '打开源站 ↗' : '返回架上'}</small>
          </a>
        </aside>
        <main className={`source-detail-page source-detail-page-${kind}`}>
        <a className="source-back" href={home}>
          ← 返回{titleLabel}架
        </a>
        <article className="source-detail-hero">
          <div className="source-detail-cover">
            {item.cover ? (
              <img src={item.cover} alt={`${item.title}封面`} />
            ) : (
              <span>{item.title.slice(0, 1)}</span>
            )}
          </div>
          <div className="source-detail-copy">
            <small>
              {sourceMeta.label} · {data.can_read ? '站内阅读' : '源站阅读'}
            </small>
            <h1>{item.title}</h1>
            {item.original_title && item.original_title !== item.title && (
              <p className="source-original">{item.original_title}</p>
            )}
            <p className="source-author">
              {item.author || item.publication || '源站未提供作者信息'}
            </p>
            <p className="source-description">{item.description || '源站没有提供简介。'}</p>
            <div className="source-detail-actions">
              {chapters[0] && (
                <a
                  className="source-primary"
                  href={chapterHref(chapters[0])}
                  target={data.can_read ? undefined : '_blank'}
                  rel={data.can_read ? undefined : 'noopener noreferrer'}
                >
                  开始阅读 <span>→</span>
                </a>
              )}
              {item.source_url && (
                <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                  查看源站 ↗
                </a>
              )}
              {kind === 'manga' && (
                <CollectionActions key={source + id} item={{ ...item, source, external_id: id }} />
              )}
            </div>
          </div>
          <dl className="source-detail-facts">
            <div>
              <dt>{chapters.length || item.total || '—'}</dt>
              <dd>{chapters.length ? '可读章节' : '总章节'}</dd>
            </div>
            <div>
              <dt>{item.rating ? Number(item.rating).toFixed(1) : '—'}</dt>
              <dd>评分</dd>
            </div>
            <div>
              <dt>{sourceMeta.id}</dt>
              <dd>来源 ID</dd>
            </div>
          </dl>
        </article>

        <section className="source-chapter-panel">
          <header>
            <div>
              <small>CATALOG</small>
              <h2>{data.can_read ? '目录与阅读' : '源站目录'}</h2>
            </div>
            <span>{chapters.length ? `${chapters.length} 个章节` : '此源未配置章节接口'}</span>
          </header>
          {chapters.length ? (
            <ol>
              {chapters.map((chapter, index) => (
                <li key={chapter.external_id}>
                  <a
                    href={chapterHref(chapter)}
                    target={data.can_read ? undefined : '_blank'}
                    rel={data.can_read ? undefined : 'noopener noreferrer'}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{chapter.title}</strong>
                    <small>
                      {chapter.volume || (data.can_read ? '站内阅读' : '源站打开')}{' '}
                      {data.can_read ? '→' : '↗'}
                    </small>
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className="source-chapter-empty">
              当前源只提供作品详情。若要在本站阅读，请在源文件中增加 <code>chapters</code> 与{' '}
              <code>reader</code> 接口；否则可通过上方源站入口阅读。
            </p>
          )}
        </section>
        </main>
      </div>
    </div>
  );
}
