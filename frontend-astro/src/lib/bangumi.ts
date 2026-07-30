import type { BangumiItem, BangumiPlaySource } from './api'

export const bangumiStatusLabels: Record<string, string> = {
  watching: '追番中',
  done: '已看完',
  plan: '想看',
  planned: '想看',
  paused: '搁置',
  dropped: '弃番',
}

export function normalizeExternalUrl(url?: string) {
  const value = String(url || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value.replace(/^\/+/, '')}`
}

export function parseBangumiPlaySources(item: Pick<BangumiItem, 'play_sources' | 'play_links'>) {
  const direct = item.play_sources
  if (Array.isArray(direct)) return sortSources(direct)
  if (Array.isArray(item.play_links)) return sortSources(item.play_links)
  try {
    const parsed = JSON.parse(String(item.play_links || '[]'))
    return Array.isArray(parsed) ? sortSources(parsed) : []
  } catch {
    return []
  }
}

function sortSources(sources: BangumiPlaySource[]) {
  return sources
    .filter((source) => source?.url)
    .sort((a, b) => {
      const defaultDiff = Number(Boolean(b.is_default)) - Number(Boolean(a.is_default))
      return defaultDiff || Number(a.sort_order || 0) - Number(b.sort_order || 0)
    })
}

export function getDefaultPlaySource(item: Pick<BangumiItem, 'play_sources' | 'play_links'>) {
  return parseBangumiPlaySources(item).find((source) => Boolean(source.is_default))
}

export function getBangumiDetailUrl(item: Pick<BangumiItem, 'external_id' | 'url'>) {
  const externalId = String(item.external_id || '').trim()
  if (externalId) return `https://bangumi.lol/subject/${encodeURIComponent(externalId)}`
  const subjectId = String(item.url || '').match(/\/subject\/(\d+)/)?.[1]
  if (subjectId) return `https://bangumi.lol/subject/${subjectId}`
  return normalizeExternalUrl(item.url)
}
