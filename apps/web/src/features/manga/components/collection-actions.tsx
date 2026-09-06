'use client';

import { useEffect, useRef, useState } from 'react';
import { ensurePrivateDeviceToken } from '../../../shared/device/private-device';
import {
  findLocalMangaCollection,
  getPrivateMangaCollections,
  removePrivateMangaCollection,
  saveLocalMangaCollection,
  syncPrivateMangaCollection,
  type MangaCollection,
} from '../collections';

export function CollectionActions({
  item,
}: {
  item: Omit<MangaCollection, 'in_shelf' | 'is_favorite'>;
}) {
  const [current, setCurrent] = useState<MangaCollection | null>(null);
  const [message, setMessage] = useState({ text: '', failed: false });
  const currentRef = useRef<MangaCollection | null>(null);
  const tokenRef = useRef('');
  const generation = useRef(0);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let disposed = false;
    const initial = findLocalMangaCollection(item.source, item.external_id);
    currentRef.current = initial;
    setCurrent(initial);
    const revision = generation.current;
    void (async () => {
      tokenRef.current = await ensurePrivateDeviceToken('/api');
      if (disposed || !tokenRef.current) return;
      try {
        const remote = (await getPrivateMangaCollections('/api', tokenRef.current)).find(
          (entry) => entry.source === item.source && entry.external_id === item.external_id,
        );
        if (disposed || generation.current !== revision || !remote) return;
        currentRef.current = remote;
        saveLocalMangaCollection(remote);
        setCurrent(remote);
      } catch {
        /* Local shelf remains usable offline. */
      }
    })();
    return () => {
      disposed = true;
      generation.current++;
    };
  }, [item.source, item.external_id]);

  const persist = (favorite: boolean) => {
    const previous = currentRef.current;
    const next: MangaCollection = {
      ...item,
      id: previous?.id,
      status: previous?.status || 'planned',
      in_shelf: favorite ? true : !previous?.in_shelf,
      is_favorite: favorite ? !previous?.is_favorite : Boolean(previous?.is_favorite),
    };
    const revision = ++generation.current;
    const keep = next.in_shelf || next.is_favorite;
    try {
      saveLocalMangaCollection(next);
    } catch {
      setMessage({ text: '浏览器存储不可用，未保存更改', failed: true });
      return;
    }
    currentRef.current = keep ? next : null;
    setCurrent(currentRef.current);
    setMessage({ text: keep ? '已加入书架（当前浏览器）' : '已从当前浏览器移除', failed: false });
    // Preserve click order remotely and never let an older response overwrite a newer click.
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        const token = tokenRef.current;
        if (!token) return;
        try {
          if (keep) {
            const saved = await syncPrivateMangaCollection('/api', token, next);
            if (generation.current === revision && saved) {
              currentRef.current = saved;
              setCurrent(saved);
              saveLocalMangaCollection(saved);
            }
          } else await removePrivateMangaCollection('/api', token, next.id, next);
          if (generation.current === revision)
            setMessage({ text: keep ? '已同步到书架' : '已从书架移除', failed: false });
        } catch {
          if (generation.current === revision)
            setMessage({
              text: keep ? '已保存在当前浏览器，云端同步失败' : '已从当前浏览器移除，云端删除失败',
              failed: true,
            });
        }
      });
  };
  return (
    <div
      className="manga-collection-actions"
      data-manga-collection=""
      data-source={item.source}
      data-external-id={item.external_id}
      data-title={item.title}
      data-original-title={item.original_title || ''}
      data-author={item.author || ''}
      data-cover={item.cover || ''}
      data-description={item.description || ''}
      data-source-url={item.source_url || ''}
      data-publication={item.publication || ''}
    >
      <button
        type="button"
        data-manga-shelf=""
        className={current?.in_shelf ? 'is-active' : ''}
        onClick={() => persist(false)}
      >
        {current?.in_shelf ? '已在书架' : '加入书架'}
      </button>
      <button
        type="button"
        data-manga-favorite=""
        className={current?.is_favorite ? 'is-active' : ''}
        onClick={() => persist(true)}
      >
        {current?.is_favorite ? '已收藏' : '收藏'}
      </button>
      <span data-manga-collection-message="" className={message.failed ? 'is-error' : ''}>
        {message.text}
      </span>
    </div>
  );
}
