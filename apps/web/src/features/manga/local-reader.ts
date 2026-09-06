import { getJson } from '../../shared/http/json';
import { internalApiOrigin } from '../../shared/site/settings';
import type { LocalChapter, LocalManga } from './local-detail';
import { cache } from 'react';
export interface ReaderChapter extends LocalChapter {
  volume_id: number;
  volume_slug: string;
  volume_title: string;
  pages?: Array<{ image_url: string }>;
}
export interface LocalReaderData {
  manga: LocalManga;
  chapter: ReaderChapter;
  navigation: ReaderChapter[];
}
export const chapterHref = (slug: string, chapter?: Pick<ReaderChapter, 'volume_slug' | 'slug'>) =>
  chapter ? `/manga/${slug}/${chapter.volume_slug}/${chapter.slug}` : '';
export const loadLocalReader = cache(async (slug: string, volume: string, chapter: string) => {
  return getJson<LocalReaderData>(
    `${internalApiOrigin()}/api/manga/${encodeURIComponent(slug)}/${encodeURIComponent(volume)}/${encodeURIComponent(chapter)}`,
    AbortSignal.timeout(10000),
  ).catch(() => null);
});
