import { getJson } from '../../shared/http/json';
import type { MangaResults, MangaSource } from './contracts';

export const mangaApi = {
  sources: (signal?: AbortSignal) =>
    getJson<{ sources: MangaSource[] }>('/api/content-sources?kind=manga', signal),
  search: (source: string, query: string, signal?: AbortSignal) =>
    getJson<MangaResults>(
      `/api/content-sources/search?kind=manga&source=${encodeURIComponent(source)}&q=${encodeURIComponent(query)}&limit=24`,
      signal,
    ),
  explore: (source: string, signal?: AbortSignal) =>
    getJson<MangaResults>(
      `/api/content-sources/explore?kind=manga&source=${encodeURIComponent(source)}&limit=12`,
      signal,
    ),
};

export function mangaDetailHref(source: string, id: string) {
  return `/source/manga/${encodeURIComponent(source)}/${encodeURIComponent(id)}`;
}

export function mangaCoverHref(source: string, url?: string) {
  return url
    ? `/api/content-sources/media?kind=manga&source=${encodeURIComponent(source)}&url=${encodeURIComponent(url)}`
    : '';
}
