import { Response } from 'express'
import db from '../config/database'
import { success, error } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

function parseSettingValue(value: string | null, type?: string) {
  if (value === null) return null
  if (type === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }
  if (type === 'boolean') {
    return value === 'true' || value === '1'
  }
  if (type === 'json') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

function getMusicTracks() {
  return db.prepare(`
    SELECT
      t.id, t.title, t.artist, t.url, t.cover, t.lyrics, t.sort_order,
      p.name AS playlist,
      p.name AS collection
    FROM music_tracks t
    LEFT JOIN music_playlists p ON p.id = t.playlist_id
    WHERE t.is_active = 1
    ORDER BY COALESCE(p.sort_order, 0) ASC, t.sort_order ASC, t.id ASC
  `).all()
}

const SETTING_LIMITS: Record<string, number> = {
  site_title: 80,
  site_description: 300,
  profile_name: 60,
  profile_avatar: 500,
  profile_bio: 200,
  active_theme: 60,
}

function normalizeSetting(key: string, value: unknown) {
  if (key === 'posts_per_page') {
    const parsed = Number(value || 10)
    return Math.max(1, Math.min(50, Number.isFinite(parsed) ? Math.trunc(parsed) : 10))
  }
  if (key === 'enable_comments' || key === 'comment_moderation') {
    return Boolean(value)
  }
  if (key === 'banner_images') {
    if (!Array.isArray(value)) return []
    return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12)
  }
  if (key === 'font_library') {
    if (!Array.isArray(value)) return []
    return value.slice(0, 80)
  }
  const limit = SETTING_LIMITS[key]
  if (limit) return String(value || '').trim().slice(0, limit)
  return value
}

export function publicSettings(_req: AuthRequest, res: Response) {
  const rows = db.prepare('SELECT key, value, type FROM settings').all() as any[]
  const map: Record<string, unknown> = {}
  const publicKeys = [
    'site_title',
    'site_description',
    'posts_per_page',
    'enable_comments',
    'active_theme',
    'music_playlist',
    'profile_name',
    'profile_avatar',
    'profile_bio',
    'banner_images',
    'font_library',
  ]

  for (const row of rows) {
    if (publicKeys.includes(row.key)) {
      map[row.key] = parseSettingValue(row.value, row.type)
    }
  }

  const musicTracks = getMusicTracks()
  if (musicTracks.length) {
    map.music_playlist = musicTracks
  }
  return success(res, map)
}

export function list(_req: AuthRequest, res: Response) {
  const settings = db.prepare('SELECT * FROM settings ORDER BY key ASC').all()
  return success(res, settings)
}

export function update(req: AuthRequest, res: Response) {
  const { settings } = req.body
  if (!settings || typeof settings !== 'object') {
    return error(res, '无效的设置数据', 'INVALID_SETTINGS', 400)
  }

  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, type, description) VALUES (?, ?, ?, ?)')
  for (const [key, rawValue] of Object.entries(settings)) {
    if (!/^[a-z0-9_:-]{1,80}$/i.test(key)) {
      return error(res, `无效的设置项：${key}`, 'INVALID_SETTING_KEY', 400)
    }
    const value = normalizeSetting(key, rawValue)
    const existing = db.prepare('SELECT description FROM settings WHERE key = ?').get(key) as any
    const isJson = typeof value === 'object' && value !== null
    stmt.run(key, isJson ? JSON.stringify(value) : String(value), isJson ? 'json' : typeof value, existing?.description || '')
  }

  return success(res, null, '设置已保存')
}
