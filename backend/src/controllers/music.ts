import { Response } from 'express'
import db from '../config/database'
import { success, error } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

const trackSelect = `
  SELECT
    t.id, t.playlist_id, t.title, t.artist, t.url, t.cover, t.lyrics,
    t.sort_order, t.is_active, t.created_at, t.updated_at,
    p.name AS playlist,
    p.name AS collection
  FROM music_tracks t
  LEFT JOIN music_playlists p ON p.id = t.playlist_id
`

function ensurePlaylist(name?: string, sortOrder = 0) {
  const playlistName = (name || '默认歌单').trim() || '默认歌单'
  const result = db.prepare(`
    INSERT OR IGNORE INTO music_playlists (name, sort_order, is_active)
    VALUES (?, ?, 1)
  `).run(playlistName, sortOrder)
  return db.prepare('SELECT id FROM music_playlists WHERE name = ?').get(playlistName) as any
}

function listTracks(includeInactive = false) {
  return db.prepare(`
    ${trackSelect}
    ${includeInactive ? '' : 'WHERE t.is_active = 1'}
    ORDER BY COALESCE(p.sort_order, 0) ASC, t.sort_order ASC, t.id ASC
  `).all()
}

function playlistRows() {
  return db.prepare(`
    SELECT
      p.id, p.name, p.description, p.cover, p.sort_order, p.is_active,
      COUNT(t.id) AS track_count
    FROM music_playlists p
    LEFT JOIN music_tracks t ON t.playlist_id = p.id
    GROUP BY p.id
    ORDER BY p.sort_order ASC, p.id ASC
  `).all()
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

const MUSIC_LIMITS = {
  tracks: 300,
  title: 120,
  artist: 120,
  playlist: 80,
  url: 500,
  cover: 500,
  lyrics: 30000,
}

export function publicList(_req: AuthRequest, res: Response) {
  return success(res, listTracks(false))
}

export function list(_req: AuthRequest, res: Response) {
  return success(res, listTracks(true))
}

export function playlists(_req: AuthRequest, res: Response) {
  return success(res, playlistRows())
}

export function createPlaylist(req: AuthRequest, res: Response) {
  const { name, description, cover, sort_order, is_active } = req.body
  const playlistName = cleanText(name)
  if (!playlistName) return error(res, '歌单名称不能为空')
  db.prepare(`
    INSERT INTO music_playlists (name, description, cover, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    playlistName,
    cleanText(description),
    cleanText(cover),
    Number(sort_order || 0),
    is_active === false ? 0 : 1,
  )
  return success(res, null, '歌单已创建')
}

export function updatePlaylist(req: AuthRequest, res: Response) {
  const { name, description, cover, sort_order, is_active } = req.body
  if (name !== undefined && !cleanText(name)) return error(res, '歌单名称不能为空')
  const result = db.prepare(`
    UPDATE music_playlists
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        cover = COALESCE(?, cover),
        sort_order = COALESCE(?, sort_order),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name === undefined ? null : cleanText(name),
    description === undefined ? null : cleanText(description),
    cover === undefined ? null : cleanText(cover),
    sort_order === undefined ? null : Number(sort_order || 0),
    is_active === undefined ? null : (is_active ? 1 : 0),
    Number(req.params.id),
  )
  if (result.changes === 0) return error(res, '歌单不存在', 'NOT_FOUND', 404)
  return success(res, null, '歌单已更新')
}

export function removePlaylist(req: AuthRequest, res: Response) {
  const id = Number(req.params.id)
  const playlist = db.prepare('SELECT id FROM music_playlists WHERE id = ?').get(id)
  if (!playlist) return error(res, '歌单不存在', 'NOT_FOUND', 404)
  db.prepare('UPDATE music_tracks SET playlist_id = NULL WHERE playlist_id = ?').run(id)
  const result = db.prepare('DELETE FROM music_playlists WHERE id = ?').run(id)
  if (result.changes === 0) return error(res, '歌单不存在', 'NOT_FOUND', 404)
  return success(res, null, '歌单已删除，歌曲已保留')
}

export function replaceAll(req: AuthRequest, res: Response) {
  const { tracks } = req.body
  if (!Array.isArray(tracks)) return error(res, '音乐列表格式不正确')
  if (tracks.length > MUSIC_LIMITS.tracks) return error(res, `音乐列表最多保存 ${MUSIC_LIMITS.tracks} 首歌曲`)
  const invalidIndexes: number[] = []
  const cleanTracks = tracks
    .map((track: any, index: number) => {
      const item = {
        title: cleanText(track?.title).slice(0, MUSIC_LIMITS.title),
        artist: cleanText(track?.artist).slice(0, MUSIC_LIMITS.artist),
        playlist: (cleanText(track?.playlist || track?.collection || '默认歌单') || '默认歌单').slice(0, MUSIC_LIMITS.playlist),
        url: cleanText(track?.url).slice(0, MUSIC_LIMITS.url),
        cover: cleanText(track?.cover).slice(0, MUSIC_LIMITS.cover),
        lyrics: cleanText(track?.lyrics).slice(0, MUSIC_LIMITS.lyrics),
        sort_order: Number(track?.sort_order ?? index),
        is_active: track?.is_active === false ? 0 : 1,
      }
      if (!item.title || !item.url) invalidIndexes.push(index + 1)
      return item
    })
  if (invalidIndexes.length) {
    return error(res, `第 ${invalidIndexes.slice(0, 5).join('、')} 首歌曲缺少标题或音频地址`)
  }

  const replace = db.transaction((items: any[]) => {
    db.prepare('DELETE FROM music_tracks').run()
    const insertTrack = db.prepare(`
      INSERT INTO music_tracks (playlist_id, title, artist, url, cover, lyrics, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    items.forEach((track, index) => {
      const playlist = ensurePlaylist(track.playlist, index)
      insertTrack.run(
        playlist?.id || null,
        track.title,
        track.artist,
        track.url,
        track.cover,
        track.lyrics,
        Number.isFinite(track.sort_order) ? track.sort_order : index,
        track.is_active,
      )
    })
  })

  replace(cleanTracks)
  return success(res, null, '音乐列表已保存')
}
