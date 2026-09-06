import { type LibraryItem } from '../use-manga-library';

export function LibraryRemoteCard({
  item,
  href,
  hidden,
}: {
  item: LibraryItem;
  href: string;
  hidden: boolean;
}) {
  const collection = item.collection!;
  const cover = /^https?:\/\//i.test(String(item.cover || '')) ? item.cover : '';
  return (
    <article
      className="manga-tile"
      data-library-remote=""
      data-manga-card=""
      data-collection-key={`${collection.source}\u0000${collection.external_id}`}
      data-id={item.id}
      data-type="network"
      data-status={item.status || 'planned'}
      hidden={hidden}
    >
      <a className="manga-tile-cover" href={href}>
        <span className="cover-index">网络</span>
        {cover ? (
          <img src={cover} alt={`${item.title}封面`} loading="lazy" decoding="async" />
        ) : (
          <span className="cover-fallback">{String(item.title || '漫').slice(0, 1)}</span>
        )}
        <b>{collection.is_favorite ? '已收藏' : '网络收藏'}</b>
        <i className="cover-glow" />
      </a>
      <div className="manga-tile-copy">
        <small>{item.author || item.publication || collection.source}</small>
        <h3>
          <a href={href}>{item.title}</a>
        </h3>
        <p>{item.description || item.original_title || '打开详情页继续阅读'}</p>
        <footer>
          <span>{collection.is_favorite ? '已收藏' : '网络收藏'}</span>
          <a data-manga-action="" href={href}>
            打开详情 →
          </a>
        </footer>
      </div>
    </article>
  );
}
