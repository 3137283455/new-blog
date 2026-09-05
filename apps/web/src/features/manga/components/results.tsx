import { mangaCoverHref, mangaDetailHref } from '../api';
import type { MangaExperience } from '../use-manga-experience';

export function MangaResults({ state }: { state: MangaExperience }) {
  if (!state.items.length)
    return (
      <div
        className="manga-result-empty"
        data-initial-placeholder={state.initialPlaceholder ? '' : undefined}
      >
        <strong>{state.empty[0]}</strong>
        <span>{state.empty[1]}</span>
      </div>
    );
  return state.items.map((item, index) => {
    const href = mangaDetailHref(item.source, item.external_id);
    const cover = mangaCoverHref(item.source, item.cover);
    return (
      <article className="manga-result-card" key={`${item.source}\0${item.external_id}\0${index}`}>
        <a className="manga-result-cover" href={href}>
          {cover ? (
            <img src={cover} alt={`${item.title}封面`} loading="lazy" decoding="async" />
          ) : (
            <span>{String(item.title || '漫').slice(0, 1)}</span>
          )}
          <i>
            {item.source_label ||
              state.sources.find((source) => source.id === item.source)?.label ||
              '漫画源'}
          </i>
          {!!Number(item.rating) && <b>★ {Number(item.rating).toFixed(1)}</b>}
        </a>
        <div>
          <small>{item.author || item.publication || '网络漫画'}</small>
          <h3>
            <a href={href}>{item.title}</a>
          </h3>
          <p>{item.total ? `${item.total} 章` : item.description || '查看作品详情'}</p>
        </div>
      </article>
    );
  });
}
