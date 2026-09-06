import { cache } from 'react';
import { getJson } from '../../shared/http/json';
import { internalApiOrigin } from '../../shared/site/settings';
import type { MangaSearchItem, MangaSource } from './contracts';

export type SourceKind = 'book' | 'manga' | 'bangumi';
export interface SourceChapter {
  external_id: string;
  title: string;
  volume?: string;
  source_url?: string;
}
export interface SourceDetail {
  source: MangaSource;
  item: MangaSearchItem & { original_title?: string; source_url?: string };
  chapters: SourceChapter[];
  can_read: boolean;
}
export const loadSourceDetail = cache(async (kind: string, source: string, id: string) => {
  if (!['book', 'manga', 'bangumi'].includes(kind)) return null;
  return getJson<SourceDetail>(
    `${internalApiOrigin()}/api/content-sources/${encodeURIComponent(kind)}/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
    AbortSignal.timeout(45000),
  ).catch(() => null);
});
export function sourceChapterHref(
  kind: SourceKind,
  source: string,
  id: string,
  chapter: SourceChapter,
  canRead: boolean,
) {
  return canRead
    ? `/source/${encodeURIComponent(kind)}/${encodeURIComponent(source)}/chapter/${encodeURIComponent(chapter.external_id)}?id=${encodeURIComponent(id)}&title=${encodeURIComponent(chapter.title || '')}`
    : chapter.source_url;
}
