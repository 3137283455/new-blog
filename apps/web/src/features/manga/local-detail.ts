import { cache } from 'react';
import { getJson } from '../../shared/http/json';
import { internalApiOrigin } from '../../shared/site/settings';
import type { LibraryItem } from './use-manga-library';

export interface LocalChapter {
  id: number;
  slug: string;
  title: string;
  page_count?: number;
}
export interface LocalVolume {
  id: number;
  slug: string;
  title: string;
  chapter_count?: number;
  chapters?: LocalChapter[];
}
export interface ReadingSource {
  id?: number;
  name: string;
  url: string;
  remark?: string;
  is_default?: boolean;
  sort_order?: number;
}
export interface LocalManga extends Omit<LibraryItem, 'read_sources'> {
  rating?: number;
  source?: string;
  source_url?: string;
  volumes?: LocalVolume[];
  read_sources?: ReadingSource[];
}
export const loadLocalManga = cache(async (slug: string) =>
  getJson<LocalManga>(
    `${internalApiOrigin()}/api/manga/${encodeURIComponent(slug)}`,
    AbortSignal.timeout(10000),
  ).catch(() => null),
);
