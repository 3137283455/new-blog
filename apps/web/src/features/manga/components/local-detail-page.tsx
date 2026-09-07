'use client';
import { MangaSiteHeader } from './site-header';
import type { LocalManga } from '../local-detail';
import { useLocalProgress } from '../use-local-progress';
export function LocalDetailPage({ item }: { item: LocalManga }) {
  const isLocal = item.library_type === 'local',
    volumes = item.volumes || [];
  const progress = useLocalProgress(item.id, isLocal);
  const allChapters = volumes.flatMap((volume) =>
    (volume.chapters || []).map((chapter) => ({ ...chapter, volume_slug: volume.slug })),
  );
  const first = allChapters.find((chapter) => Number(chapter.page_count) > 0);
  const last = allChapters.find((chapter) => chapter.id === progress?.chapter_id);
  const resumeHref = last
    ? `/manga/${item.slug}/${last.volume_slug}/${last.slug}?page=${Math.max(1, Number(progress?.page_index) + 1)}`
    : undefined;
  const sources = [...(item.read_sources || [])].sort(
    (a, b) =>
      Number(b.is_default || false) - Number(a.is_default || false) ||
      (a.sort_order || 0) - (b.sort_order || 0),
  );
  const primary = sources[0];
  const labels: Record<string, string> = {
    reading: '在读',
    finished: '读完',
    planned: '想读',
    paused: '暂放',
  };
  const chapterCount = Number(
    item.chapter_count ||
      volumes.reduce(
        (sum, volume) => sum + Number(volume.chapter_count || volume.chapters?.length || 0),
        0,
      ),
  );
  return (
    <div className="manga-detail-shell">
      <MangaSiteHeader active="library" backHref="/manga/library" />
      <main className="manga-detail-page" data-manga-detail-refactor="" data-id={item.id}>
        <nav className="detail-breadcrumb" aria-label="当前位置">
          <a href="/manga">漫画书架</a>
          <span>/</span>
          <b>{item.title}</b>
        </nav>

        <section className="detail-hero">
          <div className="detail-cover-frame">
            {item.cover ? (
              <img src={item.cover} alt={`${item.title}封面`} />
            ) : (
              <span>{item.title.slice(0, 1)}</span>
            )}
            <i>#{String(item.sort_order || item.id).padStart(2, '0')}</i>
          </div>
          <div className="detail-copy">
            <p className="eyebrow">
              {isLocal ? 'LOCAL COMIC' : 'NETWORK COLLECTION'} <span>·</span>{' '}
              {labels[item.status || 'reading'] || '在读'}
            </p>
            <h1>{item.title}</h1>
            {item.original_title && item.original_title !== item.title && (
              <p className="detail-original">{item.original_title}</p>
            )}
            <p className="detail-author">{item.author || item.publication || '作者未填写'}</p>
            <p className="detail-description">{item.description || '这部漫画还没有简介。'}</p>
            <div className="detail-tags">
              <span>{isLocal ? '本地保存' : '网络收藏'}</span>
              {item.publication && <span>{item.publication}</span>}
              {item.rating ? (
                <span>★ {Number(item.rating).toFixed(1)}</span>
              ) : (
                <span>私人书架</span>
              )}
            </div>
            <div className="detail-actions">
              {isLocal ? (
                first ? (
                  <a
                    className="read-primary"
                    data-continue=""
                    href={resumeHref || `/manga/${item.slug}/${first.volume_slug}/${first.slug}`}
                  >
                    {resumeHref ? '继续阅读' : '开始阅读'} <span>→</span>
                  </a>
                ) : (
                  <span className="no-source">暂无可读章节</span>
                )
              ) : primary ? (
                <a
                  className="read-primary"
                  href={primary.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  去 {primary.name} 阅读 <span>↗</span>
                </a>
              ) : (
                <span className="no-source">暂无阅读源</span>
              )}
              {isLocal && (
                <a className="action-secondary" href="#contents">
                  查看目录
                </a>
              )}
              {!isLocal && item.source_url && (
                <a
                  className="action-secondary"
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  资料页 ↗
                </a>
              )}
            </div>
          </div>
          <aside className="detail-facts">
            <p className="eyebrow">AT A GLANCE</p>
            <div>
              <strong>{isLocal ? volumes.length : sources.length}</strong>
              <span>{isLocal ? '分卷' : '阅读源'}</span>
            </div>
            <div>
              <strong>{chapterCount || (isLocal ? 0 : '—')}</strong>
              <span>{isLocal ? '章节' : '收藏信息'}</span>
            </div>
            <div>
              <strong data-detail-status="">{labels[item.status || 'reading'] || '在读'}</strong>
              <span>阅读状态</span>
            </div>
          </aside>
        </section>

        <div className="detail-body-grid">
          {isLocal ? (
            <section className="detail-panel catalog-panel" id="contents">
              <header className="panel-heading">
                <div>
                  <p className="eyebrow">CONTENTS</p>
                  <h2>卷与章节</h2>
                </div>
                <span>
                  {volumes.length} 卷 · {chapterCount} 章
                </span>
              </header>
              <div className="volume-list">
                {volumes.map((volume, index) => (
                  <details
                    key={volume.id}
                    open={
                      index === 0 ||
                      !!volume.chapters?.some((chapter) => chapter.id === progress?.chapter_id)
                    }
                  >
                    <summary>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{volume.title}</strong>
                        <small>{volume.chapter_count || volume.chapters?.length || 0} 章</small>
                      </div>
                      <b>⌄</b>
                    </summary>
                    <ol>
                      {(volume.chapters || []).map((chapter, chapterIndex) => (
                        <li key={chapter.id}>
                          <a
                            className={
                              progress?.chapter_id === chapter.id ? 'is-last-read' : undefined
                            }
                            data-chapter-id={chapter.id}
                            href={`/manga/${item.slug}/${volume.slug}/${chapter.slug}`}
                          >
                            <span>{String(chapterIndex + 1).padStart(2, '0')}</span>
                            <strong>{chapter.title}</strong>
                            <small data-state="">
                              {progress?.chapter_id === chapter.id
                                ? `上次第 ${Number(progress.page_index) + 1} 页`
                                : `${chapter.page_count || 0} 页`}
                            </small>
                          </a>
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            </section>
          ) : (
            <section className="detail-panel source-panel">
              <header className="panel-heading">
                <div>
                  <p className="eyebrow">READING SOURCES</p>
                  <h2>选择阅读站点</h2>
                </div>
                <span>外部页面将在新标签页打开</span>
              </header>
              <div className="source-list">
                {sources.map((source, index) => (
                  <a
                    key={source.id || source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <b>{String(index + 1).padStart(2, '0')}</b>
                    <div>
                      <strong>{source.name}</strong>
                      <small>{source.remark || new URL(source.url).hostname}</small>
                    </div>
                    {source.is_default && <em>默认</em>}
                    <span>↗</span>
                  </a>
                ))}
                {!sources.length && (
                  <p className="panel-empty">还没有阅读源，可在后台漫画管理中添加。</p>
                )}
              </div>
            </section>
          )}
          <aside className="detail-aside">
            <section className="detail-panel info-panel">
              <header className="panel-heading">
                <div>
                  <p className="eyebrow">DETAILS</p>
                  <h2>作品信息</h2>
                </div>
              </header>
              <dl>
                <div>
                  <dt>作品状态</dt>
                  <dd>{labels[item.status || 'reading'] || '在读'}</dd>
                </div>
                <div>
                  <dt>作者</dt>
                  <dd>{item.author || '未填写'}</dd>
                </div>
                <div>
                  <dt>类型</dt>
                  <dd>{isLocal ? '本地漫画' : '网络收藏'}</dd>
                </div>
                <div>
                  <dt>来源</dt>
                  <dd>{isLocal ? '本地导入' : item.source || '自定义阅读源'}</dd>
                </div>
              </dl>
            </section>
            <section className="detail-panel detail-note">
              <p className="eyebrow">A READING NOTE</p>
              <blockquote>先把故事收进书架，再从喜欢的章节开始。</blockquote>
              <span>阅读中心 · 私人收藏</span>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
