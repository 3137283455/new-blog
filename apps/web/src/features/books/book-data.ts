import { cache } from 'react';
import { getJson } from '../../shared/http/json';
import { internalApiOrigin } from '../../shared/site/settings';
import type { BookChapterResponse, BookDetail, BookVolume } from './contracts';

const decode = (value: string) => {
  try { return decodeURIComponent(value); } catch { return value; }
};

const api = () => internalApiOrigin();

export const loadBook = cache(async (slug: string) =>
  getJson<BookDetail>(`${api()}/api/books/${encodeURIComponent(decode(slug))}`, AbortSignal.timeout(15000)).catch(() => null),
);

export const loadBookVolume = cache(async (book: string, volume: string) =>
  getJson<{ book: BookDetail; volume: BookVolume }>(
    `${api()}/api/books/${encodeURIComponent(decode(book))}/${encodeURIComponent(decode(volume))}`,
    AbortSignal.timeout(15000),
  ).catch(() => null),
);

export const loadBookChapter = cache(async (book: string, volume: string, chapter: string) =>
  getJson<BookChapterResponse>(
    `${api()}/api/books/${encodeURIComponent(decode(book))}/${encodeURIComponent(decode(volume))}/${encodeURIComponent(decode(chapter))}`,
    AbortSignal.timeout(15000),
  ).catch(() => null),
);

export { decode };
