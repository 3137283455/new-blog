import { Response } from 'express'
import crypto from 'crypto'
import db from '../config/database'
import { AuthRequest } from '../middleware/auth'
import { DeviceRequest, hashDeviceToken } from '../middleware/device'
import { success, error } from '../utils/response'

function text(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}
function integer(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.trunc(number) : fallback
}
function slugify(value: unknown, fallback = 'item') {
  const raw = text(value, 180).toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
  return raw || fallback
}
function uniqueSlug(table: 'books' | 'book_volumes' | 'book_chapters', desired: string, parent?: number) {
  const base = slugify(desired)
  let slug = base
  let index = 2
  const sql = table === 'books'
    ? 'SELECT 1 FROM books WHERE slug = ?'
    : table === 'book_volumes'
      ? 'SELECT 1 FROM book_volumes WHERE book_id = ? AND slug = ?'
      : 'SELECT 1 FROM book_chapters WHERE volume_id = ? AND slug = ?'
  while (parent == null ? db.prepare(sql).get(slug) : db.prepare(sql).get(parent, slug)) slug = base + '-' + index++
  return slug
}
function json(value: unknown, fallback: any = {}) {
  try { return typeof value === 'string' ? JSON.parse(value) : (value ?? fallback) } catch { return fallback }
}

export function registerDevice(req: AuthRequest, res: Response) {
  const name = text(req.body?.name, 100) || '私人设备'
  const platform = text(req.body?.platform, 240)
  const clientId = text(req.body?.client_id, 100)
  if (!clientId) return error(res, '缺少设备标识，请刷新后台后重试', 'DEVICE_ID_REQUIRED', 400)
  const rawToken = crypto.randomBytes(32).toString('base64url')
  const tokenHash = hashDeviceToken(rawToken)
  const exact = db.prepare(
    'SELECT id FROM private_devices WHERE user_id = ? AND client_id = ?'
  ).get(req.userId!, clientId) as { id: number } | undefined
  const legacy = exact ? undefined : db.prepare(
    "SELECT id FROM private_devices WHERE user_id = ? AND client_id = '' AND name = ? AND platform = ? ORDER BY last_seen_at DESC, id DESC LIMIT 1"
  ).get(req.userId!, name, platform) as { id: number } | undefined
  const existing = exact || legacy
  if (existing) {
    db.prepare(
      "UPDATE private_devices SET name = ?, platform = ?, client_id = ?, token_hash = ?, revoked_at = NULL, last_seen_at = datetime('now') WHERE id = ?"
    ).run(name, platform, clientId, tokenHash, existing.id)
    db.prepare(
      "DELETE FROM private_devices WHERE user_id = ? AND client_id = '' AND name = ? AND platform = ?"
    ).run(req.userId!, name, platform)
    return success(res, { id: existing.id, name, platform, token: rawToken, reused: true }, '当前设备已更新，不会重复添加')
  }
  const result = db.prepare(
    'INSERT INTO private_devices (user_id, name, platform, client_id, token_hash) VALUES (?, ?, ?, ?, ?)'
  ).run(req.userId!, name, platform, clientId, tokenHash)
  return success(res, { id: result.lastInsertRowid, name, platform, token: rawToken, reused: false }, '此设备已设为私人设备')
}
export function devices(req: AuthRequest, res: Response) {
  const rows = db.prepare(
    'SELECT id, name, platform, client_id, last_seen_at, created_at, revoked_at FROM private_devices WHERE user_id = ? ORDER BY revoked_at IS NULL DESC, last_seen_at DESC'
  ).all(req.userId!)
  return success(res, rows)
}
export function revokeDevice(req: AuthRequest, res: Response) {
  const result = db.prepare(
    "UPDATE private_devices SET revoked_at = datetime('now') WHERE id = ? AND user_id = ?"
  ).run(integer(req.params.id), req.userId!)
  if (!result.changes) return error(res, '设备不存在', 'NOT_FOUND', 404)
  return success(res, null, '设备同步权限已撤销')
}

export function getNavigationState(req: DeviceRequest, res: Response) {
  const row = db.prepare(
    'SELECT navigation_state, navigation_revision, updated_at FROM personal_sync_state WHERE user_id = ?'
  ).get(req.deviceUserId!) as any
  return success(res, {
    state: json(row?.navigation_state),
    revision: row?.navigation_revision || 0,
    updated_at: row?.updated_at || null,
  })
}
export function putNavigationState(req: DeviceRequest, res: Response) {
  const state = req.body?.state
  if (!state || typeof state !== 'object' || Array.isArray(state)) return error(res, '同步数据格式无效', 'VALIDATION_ERROR')
  const encoded = JSON.stringify(state)
  if (Buffer.byteLength(encoded) > 512 * 1024) return error(res, '同步数据过大', 'SYNC_TOO_LARGE', 413)
  const current = db.prepare('SELECT navigation_revision FROM personal_sync_state WHERE user_id = ?').get(req.deviceUserId!) as any
  const clientRevision = integer(req.body?.revision, 0)
  if (current && clientRevision !== current.navigation_revision && !req.body?.force) {
    const server = db.prepare('SELECT navigation_state, navigation_revision, updated_at FROM personal_sync_state WHERE user_id = ?').get(req.deviceUserId!) as any
    return res.status(409).json({ success: false, code: 'SYNC_CONFLICT', message: '其他设备已经更新导航数据', data: {
      server: { state: json(server.navigation_state), revision: server.navigation_revision, updated_at: server.updated_at },
      submitted: { state, revision: clientRevision },
    } })
  }
  const revision = (current?.navigation_revision || 0) + 1
  db.prepare(
    "INSERT INTO personal_sync_state (user_id, navigation_state, navigation_revision, updated_by_device_id, updated_at) VALUES (?, ?, ?, ?, datetime('now')) " +
    "ON CONFLICT(user_id) DO UPDATE SET navigation_state = excluded.navigation_state, navigation_revision = excluded.navigation_revision, updated_by_device_id = excluded.updated_by_device_id, updated_at = datetime('now')"
  ).run(req.deviceUserId!, encoded, revision, req.deviceId!)
  return success(res, { revision }, '导航数据已同步')
}

function publicBook(slug: string) {
  return db.prepare(
    "SELECT b.*, (SELECT COUNT(*) FROM book_volumes v WHERE v.book_id=b.id AND v.deleted_at IS NULL) volume_count, " +
    "(SELECT COUNT(*) FROM book_chapters c JOIN book_volumes v2 ON v2.id=c.volume_id WHERE v2.book_id=b.id AND v2.deleted_at IS NULL) chapter_count " +
    "FROM books b WHERE b.slug = ? AND b.status = 'published' AND b.deleted_at IS NULL"
  ).get(slug) as any
}
export function privateLibrary(req: DeviceRequest, res: Response) {
  const rows = db.prepare(
    "SELECT b.id, b.slug, b.title, b.cover, s.volume_id, s.chapter_id, s.position chapter_progress, s.mode, s.updated_at progress_updated_at, " +
    "v.slug volume_slug, v.title volume_title, c.slug chapter_slug, c.title chapter_title, " +
    "(SELECT COUNT(*) FROM book_chapters tc JOIN book_volumes tv ON tv.id=tc.volume_id WHERE tv.book_id=b.id AND tv.deleted_at IS NULL) chapter_count, " +
    "(SELECT COUNT(*) FROM book_chapters pc JOIN book_volumes pv ON pv.id=pc.volume_id WHERE pv.book_id=b.id AND pv.deleted_at IS NULL AND (pv.sort_order<v.sort_order OR (pv.id=v.id AND (pc.sort_order<c.sort_order OR (pc.sort_order=c.sort_order AND pc.id<c.id))))) chapters_before " +
    "FROM reading_states s JOIN books b ON b.id=s.book_id LEFT JOIN book_volumes v ON v.id=s.volume_id LEFT JOIN book_chapters c ON c.id=s.chapter_id " +
    "WHERE s.user_id=? AND b.status='published' AND b.deleted_at IS NULL ORDER BY s.updated_at DESC"
  ).all(req.deviceUserId!) as any[]
  rows.forEach((row) => {
    const total = Math.max(1, Number(row.chapter_count) || 1)
    const current = Math.max(0, Number(row.chapters_before) || 0)
    row.chapter_progress = Math.max(0, Math.min(1, Number(row.chapter_progress) || 0))
    row.overall_progress = Math.max(0, Math.min(1, (current + row.chapter_progress) / total))
    row.chapter_number = current + 1
    delete row.chapters_before
  })
  return success(res, rows)
}
export function books(_req: DeviceRequest, res: Response) {
  const rows = db.prepare(
    "SELECT b.*, (SELECT COUNT(*) FROM book_volumes v WHERE v.book_id=b.id AND v.deleted_at IS NULL) volume_count, " +
    "(SELECT COUNT(*) FROM book_chapters c JOIN book_volumes v2 ON v2.id=c.volume_id WHERE v2.book_id=b.id AND v2.deleted_at IS NULL) chapter_count " +
    "FROM books b WHERE b.status='published' AND b.deleted_at IS NULL ORDER BY b.is_featured DESC, b.sort_order, b.updated_at DESC"
  ).all()
  return success(res, rows)
}
export function bookDetail(req: DeviceRequest, res: Response) {
  const book = publicBook(String(req.params.book))
  if (!book) return error(res, '书籍不存在', 'NOT_FOUND', 404)
  book.volumes = db.prepare(
    'SELECT v.*, (SELECT COUNT(*) FROM book_chapters c WHERE c.volume_id=v.id) chapter_count FROM book_volumes v WHERE v.book_id=? AND v.deleted_at IS NULL ORDER BY v.sort_order, v.id'
  ).all(book.id)
  return success(res, book)
}
export function volumeDetail(req: DeviceRequest, res: Response) {
  const book = publicBook(String(req.params.book))
  if (!book) return error(res, '书籍不存在', 'NOT_FOUND', 404)
  const volume = db.prepare(
    'SELECT * FROM book_volumes WHERE book_id=? AND slug=? AND deleted_at IS NULL'
  ).get(book.id, String(req.params.volume)) as any
  if (!volume) return error(res, '分卷不存在', 'NOT_FOUND', 404)
  volume.chapters = db.prepare(
    'SELECT id, title, slug, sort_order FROM book_chapters WHERE volume_id=? ORDER BY sort_order, id'
  ).all(volume.id)
  return success(res, { book, volume })
}
export function chapterDetail(req: DeviceRequest, res: Response) {
  const book = publicBook(String(req.params.book))
  if (!book) return error(res, '书籍不存在', 'NOT_FOUND', 404)
  const chapter = db.prepare(
    'SELECT c.*, v.title volume_title, v.slug volume_slug, v.id volume_id FROM book_chapters c JOIN book_volumes v ON v.id=c.volume_id WHERE v.book_id=? AND v.slug=? AND c.slug=? AND v.deleted_at IS NULL'
  ).get(book.id, String(req.params.volume), String(req.params.chapter)) as any
  if (!chapter) return error(res, '章节不存在', 'NOT_FOUND', 404)
  const navigation = db.prepare(
    'SELECT c.id, c.title, c.slug, c.sort_order, v.id volume_id, v.title volume_title, v.slug volume_slug FROM book_chapters c JOIN book_volumes v ON v.id=c.volume_id WHERE v.book_id=? AND v.deleted_at IS NULL ORDER BY v.sort_order, v.id, c.sort_order, c.id'
  ).all(book.id)
  return success(res, { book, chapter, navigation })
}

export function adminBooks(req: AuthRequest, res: Response) {
  const rows = db.prepare(
    'SELECT b.*, (SELECT COUNT(*) FROM book_volumes v WHERE v.book_id=b.id AND v.deleted_at IS NULL) volume_count FROM books b ORDER BY b.deleted_at IS NOT NULL, b.sort_order, b.updated_at DESC'
  ).all()
  return success(res, rows)
}
export function adminBookDetail(req: AuthRequest, res: Response) {
  const book = db.prepare('SELECT * FROM books WHERE id=?').get(integer(req.params.id)) as any
  if (!book) return error(res, '书籍不存在', 'NOT_FOUND', 404)
  book.volumes = db.prepare('SELECT * FROM book_volumes WHERE book_id=? ORDER BY deleted_at IS NOT NULL, sort_order, id').all(book.id)
  for (const volume of book.volumes) {
    volume.chapters = db.prepare('SELECT id,title,slug,sort_order,updated_at FROM book_chapters WHERE volume_id=? ORDER BY sort_order,id').all(volume.id)
  }
  return success(res, book)
}
export function createBook(req: AuthRequest, res: Response) {
  const title = text(req.body?.title, 200)
  if (!title) return error(res, '请输入书名', 'VALIDATION_ERROR')
  const slug = uniqueSlug('books', req.body?.slug || title)
  const result = db.prepare(
    'INSERT INTO books (title,slug,author,description,cover,status,reading_status,sort_order,is_featured) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(title, slug, text(req.body?.author, 160), text(req.body?.description, 4000), text(req.body?.cover, 500),
    req.body?.status === 'draft' ? 'draft' : 'published', text(req.body?.reading_status, 30) || 'reading',
    integer(req.body?.sort_order), req.body?.is_featured ? 1 : 0)
  return success(res, db.prepare('SELECT * FROM books WHERE id=?').get(result.lastInsertRowid), '书籍已创建')
}
export function updateBook(req: AuthRequest, res: Response) {
  const id = integer(req.params.id)
  const row = db.prepare('SELECT * FROM books WHERE id=?').get(id) as any
  if (!row) return error(res, '书籍不存在', 'NOT_FOUND', 404)
  let slug = slugify(req.body?.slug ?? row.slug)
  if (db.prepare('SELECT 1 FROM books WHERE slug=? AND id!=?').get(slug,id)) slug = uniqueSlug('books', slug)
  db.prepare(
    "UPDATE books SET title=?,slug=?,author=?,description=?,cover=?,status=?,reading_status=?,sort_order=?,is_featured=?,updated_at=datetime('now') WHERE id=?"
  ).run(text(req.body?.title ?? row.title,200),slug,text(req.body?.author ?? row.author,160),text(req.body?.description ?? row.description,4000),
    text(req.body?.cover ?? row.cover,500), req.body?.status === 'draft' ? 'draft' : 'published',
    text(req.body?.reading_status ?? row.reading_status,30), integer(req.body?.sort_order,row.sort_order),
    req.body?.is_featured === undefined ? row.is_featured : (req.body.is_featured ? 1 : 0),id)
  return success(res, db.prepare('SELECT * FROM books WHERE id=?').get(id), '书籍已保存')
}
export function removeBook(req: AuthRequest, res: Response) {
  const result = db.prepare("UPDATE books SET deleted_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND deleted_at IS NULL").run(integer(req.params.id))
  if (!result.changes) return error(res,'书籍不存在','NOT_FOUND',404)
  return success(res,null,'书籍已移入回收站')
}
export function restoreBook(req: AuthRequest, res: Response) {
  const result = db.prepare("UPDATE books SET deleted_at=NULL,updated_at=datetime('now') WHERE id=?").run(integer(req.params.id))
  if (!result.changes) return error(res,'书籍不存在','NOT_FOUND',404)
  return success(res,null,'书籍已恢复')
}
export function createVolume(req: AuthRequest, res: Response) {
  const bookId=integer(req.params.id), title=text(req.body?.title,200)
  if(!db.prepare('SELECT 1 FROM books WHERE id=?').get(bookId)) return error(res,'书籍不存在','NOT_FOUND',404)
  if(!title) return error(res,'请输入卷名','VALIDATION_ERROR')
  const slug=uniqueSlug('book_volumes',req.body?.slug||title,bookId)
  const result=db.prepare('INSERT INTO book_volumes (book_id,title,slug,description,cover,sort_order,source_filename) VALUES (?,?,?,?,?,?,?)')
    .run(bookId,title,slug,text(req.body?.description,2000),text(req.body?.cover,500),integer(req.body?.sort_order),text(req.body?.source_filename,255))
  return success(res,db.prepare('SELECT * FROM book_volumes WHERE id=?').get(result.lastInsertRowid),'分卷已创建')
}
export function updateVolume(req: AuthRequest,res: Response){
  const id=integer(req.params.volumeId), row=db.prepare('SELECT * FROM book_volumes WHERE id=?').get(id) as any
  if(!row) return error(res,'分卷不存在','NOT_FOUND',404)
  const title=text(req.body?.title??row.title,200)
  db.prepare("UPDATE book_volumes SET title=?,description=?,cover=?,sort_order=?,updated_at=datetime('now') WHERE id=?")
    .run(title,text(req.body?.description??row.description,2000),text(req.body?.cover??row.cover,500),integer(req.body?.sort_order,row.sort_order),id)
  return success(res,db.prepare('SELECT * FROM book_volumes WHERE id=?').get(id),'分卷已保存')
}
export function removeVolume(req: AuthRequest,res: Response){
  const result=db.prepare("UPDATE book_volumes SET deleted_at=datetime('now'),updated_at=datetime('now') WHERE id=?").run(integer(req.params.volumeId))
  if(!result.changes) return error(res,'分卷不存在','NOT_FOUND',404)
  return success(res,null,'分卷已移入回收站')
}
export function createChapter(req: AuthRequest,res: Response){
  const volumeId=integer(req.params.volumeId), title=text(req.body?.title,200)
  if(!db.prepare('SELECT 1 FROM book_volumes WHERE id=?').get(volumeId)) return error(res,'分卷不存在','NOT_FOUND',404)
  if(!title) return error(res,'请输入章节名','VALIDATION_ERROR')
  const slug=uniqueSlug('book_chapters',req.body?.slug||title,volumeId)
  const result=db.prepare('INSERT INTO book_chapters (volume_id,title,slug,content_html,sort_order,source_key) VALUES (?,?,?,?,?,?)')
    .run(volumeId,title,slug,String(req.body?.content_html||''),integer(req.body?.sort_order),text(req.body?.source_key,500))
  return success(res,db.prepare('SELECT * FROM book_chapters WHERE id=?').get(result.lastInsertRowid),'章节已创建')
}
export function updateChapter(req: AuthRequest,res: Response){
  const id=integer(req.params.chapterId), row=db.prepare('SELECT * FROM book_chapters WHERE id=?').get(id) as any
  if(!row) return error(res,'章节不存在','NOT_FOUND',404)
  db.prepare("UPDATE book_chapters SET title=?,content_html=?,sort_order=?,updated_at=datetime('now') WHERE id=?")
    .run(text(req.body?.title??row.title,200),String(req.body?.content_html??row.content_html),integer(req.body?.sort_order,row.sort_order),id)
  return success(res,db.prepare('SELECT * FROM book_chapters WHERE id=?').get(id),'章节已保存')
}
export function removeChapter(req: AuthRequest,res: Response){
  const result=db.prepare('DELETE FROM book_chapters WHERE id=?').run(integer(req.params.chapterId))
  if(!result.changes) return error(res,'章节不存在','NOT_FOUND',404)
  return success(res,null,'章节已删除')
}

export function getReadingState(req: DeviceRequest,res: Response){
  const row=db.prepare('SELECT * FROM reading_states WHERE user_id=? AND book_id=?').get(req.deviceUserId!,integer(req.params.bookId)) as any
  if(row) row.settings=json(row.settings)
  return success(res,row||null)
}
export function putReadingState(req: DeviceRequest,res: Response){
  const userId=req.deviceUserId!, bookId=integer(req.params.bookId)
  if(!db.prepare("SELECT 1 FROM books WHERE id=? AND deleted_at IS NULL").get(bookId)) return error(res,'书籍不存在','NOT_FOUND',404)
  const current=db.prepare('SELECT * FROM reading_states WHERE user_id=? AND book_id=?').get(userId,bookId) as any
  const base=integer(req.body?.revision,0)
  const sameDevice=Boolean(current&&Number(current.device_id)===Number(req.deviceId))
  if(current && base!==current.revision && !sameDevice && !req.body?.force){
    current.settings=json(current.settings)
    return res.status(409).json({success:false,code:'READING_CONFLICT',message:'另一台设备已有更新，请选择保留哪一份进度',data:{server:current,submitted:req.body}})
  }
  const revision=(current?.revision||0)+1
  const settings=JSON.stringify(req.body?.settings&&typeof req.body.settings==='object'?req.body.settings:{})
  db.prepare(
    "INSERT INTO reading_states (user_id,book_id,volume_id,chapter_id,mode,position,anchor,settings,revision,device_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now')) "+
    "ON CONFLICT(user_id,book_id) DO UPDATE SET volume_id=excluded.volume_id,chapter_id=excluded.chapter_id,mode=excluded.mode,position=excluded.position,anchor=excluded.anchor,settings=excluded.settings,revision=excluded.revision,device_id=excluded.device_id,updated_at=datetime('now')"
  ).run(userId,bookId,integer(req.body?.volume_id)||null,integer(req.body?.chapter_id)||null,req.body?.mode==='paged'?'paged':'scroll',
    Math.max(0,Math.min(1,Number(req.body?.position)||0)),text(req.body?.anchor,500),settings,revision,req.deviceId!)
  return success(res,{revision},'阅读进度已同步')
}
export function annotations(req: DeviceRequest,res: Response){
  const rows=db.prepare('SELECT a.*, c.title chapter_title, c.slug chapter_slug, v.title volume_title, v.slug volume_slug FROM reader_annotations a LEFT JOIN book_chapters c ON c.id=a.chapter_id LEFT JOIN book_volumes v ON v.id=a.volume_id WHERE a.user_id=? AND a.book_id=? ORDER BY a.updated_at DESC').all(req.deviceUserId!,integer(req.params.bookId)) as any[]
  rows.forEach(row=>row.position=json(row.position))
  return success(res,rows)
}
export function createAnnotation(req: DeviceRequest,res: Response){
  const bookId=integer(req.params.bookId), type=['bookmark','highlight','note'].includes(req.body?.type)?req.body.type:'bookmark'
  const result=db.prepare(
    'INSERT INTO reader_annotations (user_id,book_id,volume_id,chapter_id,type,quote,prefix,suffix,note,color,position,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(req.deviceUserId!,bookId,integer(req.body?.volume_id)||null,integer(req.body?.chapter_id)||null,type,text(req.body?.quote,4000),
    text(req.body?.prefix,500),text(req.body?.suffix,500),text(req.body?.note,8000),text(req.body?.color,40),
    JSON.stringify(req.body?.position||{}),req.body?.status==='pending'?'pending':'active')
  return success(res,db.prepare('SELECT * FROM reader_annotations WHERE id=?').get(result.lastInsertRowid),'标注已保存')
}
export function updateAnnotation(req: DeviceRequest,res: Response){
  const id=integer(req.params.annotationId)
  const row=db.prepare('SELECT * FROM reader_annotations WHERE id=? AND user_id=?').get(id,req.deviceUserId!) as any
  if(!row) return error(res,'标注不存在','NOT_FOUND',404)
  db.prepare(
    "UPDATE reader_annotations SET note=?,color=?,position=?,status=?,updated_at=datetime('now') WHERE id=?"
  ).run(text(req.body?.note??row.note,8000),text(req.body?.color??row.color,40),JSON.stringify(req.body?.position??json(row.position)),
    req.body?.status==='pending'?'pending':'active',id)
  return success(res,db.prepare('SELECT * FROM reader_annotations WHERE id=?').get(id),'标注已更新')
}
export function removeAnnotation(req: DeviceRequest,res: Response){
  const result=db.prepare('DELETE FROM reader_annotations WHERE id=? AND user_id=?').run(integer(req.params.annotationId),req.deviceUserId!)
  if(!result.changes) return error(res,'标注不存在','NOT_FOUND',404)
  return success(res,null,'标注已删除')
}
export function pendingAnnotations(req: AuthRequest,res: Response){
  const bookId=integer(req.params.id)
  const rows=db.prepare("SELECT a.*,c.title chapter_title FROM reader_annotations a LEFT JOIN book_chapters c ON c.id=a.chapter_id WHERE a.book_id=? AND a.status='pending' ORDER BY a.updated_at DESC").all(bookId)
  return success(res,rows)
}
export function resolveAnnotation(req: AuthRequest,res: Response){
  const bookId=integer(req.params.id),annotationId=integer(req.params.annotationId),chapterId=integer(req.body?.chapter_id)
  const chapter=db.prepare('SELECT c.id,c.volume_id FROM book_chapters c JOIN book_volumes v ON v.id=c.volume_id WHERE c.id=? AND v.book_id=?').get(chapterId,bookId) as any
  if(!chapter)return error(res,'目标章节不属于这本书','VALIDATION_ERROR',400)
  const result=db.prepare("UPDATE reader_annotations SET chapter_id=?,volume_id=?,status='active',updated_at=datetime('now') WHERE id=? AND book_id=?").run(chapter.id,chapter.volume_id,annotationId,bookId)
  if(!result.changes)return error(res,'待恢复标注不存在','NOT_FOUND',404)
  return success(res,null,'标注已重新定位')
}