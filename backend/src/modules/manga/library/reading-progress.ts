import type Database from 'better-sqlite3'

type ReadingState = { revision: number; device_id: number; settings: string; [key: string]: unknown }
const integer = (value: unknown) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0
export type SaveProgressResult = { status: 'saved'; revision: number } | { status: 'missing' | 'invalid-chapter' } | { status: 'conflict'; server: ReadingState }

/** Reading state is one atomic per-user/per-manga record, never a cross-library chapter. */
export class ReadingProgressRepository {
  constructor(private readonly db: Database.Database) {}
  get(userId: number, mangaId: number) {
    const row = this.db.prepare('SELECT * FROM manga_reading_states WHERE user_id=? AND manga_id=?').get(userId, mangaId) as ReadingState | undefined
    if (!row) return null
    let settings: Record<string, unknown> = {}
    try { settings = JSON.parse(row.settings || '{}') } catch {}
    return { ...row, settings }
  }
  save(userId: number, deviceId: number, mangaId: number, input: Record<string, unknown>): SaveProgressResult {
    return this.db.transaction((): SaveProgressResult => {
      if (!this.db.prepare("SELECT 1 FROM manga_items WHERE id=? AND library_type='local'").get(mangaId)) return { status: 'missing' }
      const chapterId = integer(input.chapter_id), volumeId = integer(input.volume_id)
      if (!this.db.prepare('SELECT 1 FROM manga_chapters c JOIN manga_volumes v ON v.id=c.volume_id WHERE c.id=? AND v.id=? AND v.manga_id=?').get(chapterId, volumeId, mangaId)) return { status: 'invalid-chapter' }
      const current = this.db.prepare('SELECT * FROM manga_reading_states WHERE user_id=? AND manga_id=?').get(userId, mangaId) as ReadingState | undefined
      const sameDevice = current && Number(current.device_id) === deviceId
      if (current && integer(input.revision) !== current.revision && !sameDevice && !input.force) return { status: 'conflict', server: current }
      const revision = (current?.revision || 0) + 1
      const mode = input.mode === 'paged' || input.mode === 'double' ? input.mode : 'scroll'
      this.db.prepare("INSERT INTO manga_reading_states (user_id,manga_id,volume_id,chapter_id,page_index,mode,settings,revision,device_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(user_id,manga_id) DO UPDATE SET volume_id=excluded.volume_id,chapter_id=excluded.chapter_id,page_index=excluded.page_index,mode=excluded.mode,settings=excluded.settings,revision=excluded.revision,device_id=excluded.device_id,updated_at=datetime('now')").run(userId,mangaId,volumeId,chapterId,Math.max(0,integer(input.page_index)),mode,JSON.stringify(input.settings && typeof input.settings === 'object' ? input.settings : {}),revision,deviceId)
      return { status: 'saved', revision }
    })()
  }
  library(userId: number) {
    return this.db.prepare("SELECT m.id,m.slug,m.title,m.cover,s.volume_id,s.chapter_id,s.page_index,s.mode,s.updated_at progress_updated_at,v.slug volume_slug,v.title volume_title,c.slug chapter_slug,c.title chapter_title,(SELECT COUNT(*) FROM manga_pages p WHERE p.chapter_id=c.id) page_count FROM manga_reading_states s JOIN manga_items m ON m.id=s.manga_id LEFT JOIN manga_volumes v ON v.id=s.volume_id LEFT JOIN manga_chapters c ON c.id=s.chapter_id WHERE s.user_id=? AND m.is_active=1 ORDER BY s.updated_at DESC").all(userId)
  }
}
