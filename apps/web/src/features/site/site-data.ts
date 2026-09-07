import { cache } from 'react';
import { getJson } from '../../shared/http/json';
import { internalApiOrigin } from '../../shared/site/settings';

const api = () => internalApiOrigin();
const request = <T>(path: string) => getJson<T>(`${api()}/api${path}`, AbortSignal.timeout(15000));

export const loadArticles = cache(async (query = '') => request<any>(`/articles${query}`).catch(() => []));
export const loadArticle = cache(async (slug: string) => request<any>(`/articles/${encodeURIComponent(slug)}`).catch(() => null));
export const loadSeries = cache(async () => request<any[]>('/series').catch(() => []));
export const loadSeriesDetail = cache(async (slug: string) => request<any>(`/series/${encodeURIComponent(slug)}`).catch(() => null));
export const loadNavigation = cache(async () => request<any[]>('/navigation').catch(() => []));
export const loadBangumi = cache(async () => request<any[]>('/bangumi').catch(() => []));
export const loadAlbums = cache(async () => request<any[]>('/albums').catch(() => []));
export const loadAlbum = cache(async (id: string) => request<any>(`/albums/${encodeURIComponent(id)}`).catch(() => null));
export const loadMusic = cache(async () => request<any[]>('/music').catch(() => []));
export const loadMemories = cache(async (year: number) => request<any>(`/hub/insights?year=${year}`).catch(() => null));
export const loadPage = cache(async (slug: string) => request<any>(`/pages/${encodeURIComponent(slug)}`).catch(() => null));
export const loadSettings = cache(async () => request<any>('/settings/public').catch(() => ({})));
