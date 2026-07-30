import db from '../config/database'

export interface BangumiPlaySourceInput {
  id?: number
  name?: string
  url?: string
  remark?: string
  is_default?: boolean | number
  sort_order?: number
}

const sourceSelect = `
  SELECT id, bangumi_id, name, url, remark, is_default, sort_order, created_at, updated_at
  FROM bangumi_play_sources
`

function cleanText(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

export function normalizePlaySources(value: unknown): BangumiPlaySourceInput[] {
  let sources = value
  if (typeof value === 'string') {
    try {
      sources = JSON.parse(value)
    } catch {
      sources = value.split(/\r?\n/).map((line) => {
        const [name, url, ...remark] = line.split('|')
        return { name, url, remark: remark.join('|') }
      })
    }
  }
  if (!Array.isArray(sources)) return []

  let defaultAssigned = false
  return sources
    .map((source, index) => {
      const requestedDefault = Boolean(source?.is_default ?? source?.isDefault)
      const isDefault = requestedDefault && !defaultAssigned
      if (isDefault) defaultAssigned = true
      return {
        name: cleanText(source?.name || '播放源', 60),
        url: cleanText(source?.url, 500),
        remark: cleanText(source?.remark, 120),
        is_default: isDefault ? 1 : 0,
        sort_order: Number.isFinite(Number(source?.sort_order))
          ? Math.max(-9999, Math.min(9999, Math.trunc(Number(source.sort_order))))
          : index,
      }
    })
    .filter((source) => source.url)
    .slice(0, 20)
}

export function listPlaySources(bangumiId: number) {
  return db.prepare(`
    ${sourceSelect}
    WHERE bangumi_id = ?
    ORDER BY is_default DESC, sort_order ASC, id ASC
  `).all(bangumiId)
}

export function attachPlaySources<T extends { id: number; play_links?: unknown }>(rows: T[]) {
  if (!rows.length) return rows
  const placeholders = rows.map(() => '?').join(',')
  const sources = db.prepare(`
    ${sourceSelect}
    WHERE bangumi_id IN (${placeholders})
    ORDER BY is_default DESC, sort_order ASC, id ASC
  `).all(...rows.map((row) => row.id)) as Array<Record<string, any>>
  const grouped = new Map<number, Array<Record<string, any>>>()
  for (const source of sources) {
    const list = grouped.get(source.bangumi_id) || []
    list.push(source)
    grouped.set(source.bangumi_id, list)
  }
  return rows.map((row) => {
    const playSources = grouped.get(row.id) || []
    return {
      ...row,
      play_sources: playSources,
      play_links: JSON.stringify(playSources),
    }
  })
}

export function replacePlaySources(bangumiId: number, value: unknown) {
  const sources = normalizePlaySources(value)
  db.prepare('DELETE FROM bangumi_play_sources WHERE bangumi_id = ?').run(bangumiId)
  const insert = db.prepare(`
    INSERT INTO bangumi_play_sources
      (bangumi_id, name, url, remark, is_default, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const source of sources) {
    insert.run(
      bangumiId,
      source.name,
      source.url,
      source.remark,
      source.is_default,
      source.sort_order,
    )
  }
  return sources
}

export function insertPlaySource(bangumiId: number, value: unknown) {
  const source = normalizePlaySources([value])[0]
  if (!source) return null
  if (source.is_default) {
    db.prepare('UPDATE bangumi_play_sources SET is_default = 0 WHERE bangumi_id = ?').run(bangumiId)
  }
  const result = db.prepare(`
    INSERT INTO bangumi_play_sources
      (bangumi_id, name, url, remark, is_default, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    bangumiId,
    source.name,
    source.url,
    source.remark,
    source.is_default,
    source.sort_order,
  )
  return db.prepare(`${sourceSelect} WHERE id = ?`).get(Number(result.lastInsertRowid))
}

export function updatePlaySource(bangumiId: number, sourceId: number, value: unknown) {
  const source = normalizePlaySources([value])[0]
  if (!source) return null
  if (source.is_default) {
    db.prepare('UPDATE bangumi_play_sources SET is_default = 0 WHERE bangumi_id = ?').run(bangumiId)
  }
  const result = db.prepare(`
    UPDATE bangumi_play_sources
    SET name = ?, url = ?, remark = ?, is_default = ?, sort_order = ?, updated_at = datetime('now')
    WHERE id = ? AND bangumi_id = ?
  `).run(
    source.name,
    source.url,
    source.remark,
    source.is_default,
    source.sort_order,
    sourceId,
    bangumiId,
  )
  if (!result.changes) return null
  return db.prepare(`${sourceSelect} WHERE id = ?`).get(sourceId)
}

export function deletePlaySource(bangumiId: number, sourceId: number) {
  return db.prepare(`
    DELETE FROM bangumi_play_sources
    WHERE id = ? AND bangumi_id = ?
  `).run(sourceId, bangumiId).changes > 0
}
