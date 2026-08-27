import { Response } from 'express'
import db from '../config/database'
import { AuthRequest } from '../middleware/auth'
import { detailContentSource, NormalizedContentSubject, searchContentSource } from '../services/content-search-sources'
import { success, error } from '../utils/response'

const browserUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
function clean(value: unknown, max = 500) { return String(value ?? '').trim().slice(0, max) }
function number(value: unknown, fallback = 0) { const result = Number(value); return Number.isFinite(result) ? result : fallback }
function slugify(value: unknown) { return clean(value, 180).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'manga' }
function uniqueSlug(value: unknown, exclude = 0) { const base = slugify(value); let slug = base, index = 2; while (db.prepare('SELECT 1 FROM manga_items WHERE slug=? AND id!=?').get(slug, exclude)) slug = `${base}-${index++}`; return slug }
function validUrl(value: unknown) { const url = clean(value, 1000); return /^https?:\/\//i.test(url) ? url : '' }
function normalizeSources(input: unknown) {
  const list = Array.isArray(input) ? input : []
  let defaultUsed = false
  return list.map((source: any, index) => ({ name: clean(source?.name, 60) || `阅读源 ${index + 1}`, url: validUrl(source?.url), remark: clean(source?.remark, 120), is_default: Boolean(source?.is_default) && !defaultUsed, sort_order: Math.trunc(number(source?.sort_order, index)) })).filter((source) => source.url).map((source, index) => { if (source.is_default) defaultUsed = true; if (!defaultUsed && index === 0) { source.is_default = true; defaultUsed = true } return source }).slice(0, 20)
}
function sources(id: number) { return db.prepare('SELECT id,manga_id,name,url,remark,is_default,sort_order FROM manga_read_sources WHERE manga_id=? ORDER BY is_default DESC,sort_order,id').all(id) }
function attach(row: any) { if (!row) return row; row.read_sources = sources(row.id); return row }
function select(where = '') { return `SELECT * FROM manga_items ${where}` }

export function publicList(_req: AuthRequest, res: Response) { return success(res, (db.prepare(select("WHERE is_active=1 ORDER BY sort_order,id DESC")).all() as any[]).map(attach)) }
export function publicDetail(req: AuthRequest, res: Response) { const row = db.prepare(select("WHERE slug=? AND is_active=1")).get(clean(req.params.slug, 180)); return row ? success(res, attach(row)) : error(res, '漫画不存在', 'NOT_FOUND', 404) }
export function list(_req: AuthRequest, res: Response) { return success(res, (db.prepare(select('ORDER BY sort_order,id DESC')).all() as any[]).map(attach)) }

function normalizedSubject(item: NormalizedContentSubject) {
  return { external_id: item.external_id, source: item.source, source_label: item.source_label, title: item.title, original_title: item.original_title, author: '', cover: item.cover, source_url: item.source_url, rating: item.rating, publication: item.publication, description: item.description }
}
function searchHeaders(req: AuthRequest) { const incoming = clean(req.get('user-agent'), 500); return { 'User-Agent': /^Mozilla\/5\.0/i.test(incoming) ? incoming : browserUA, 'X-Application-User-Agent': 'new-blog/1.0.0 (https://github.com/3137283455/new-blog)' } }
export async function searchSource(req: AuthRequest, res: Response) {
  const query = clean(req.query.q, 100), id = clean(req.query.id, 80)
  if (!query && !id) return error(res, '请输入漫画名称或数据源 ID')
  try {
    if (id) { const result = await detailContentSource('manga', id, undefined, searchHeaders(req)); return success(res, [normalizedSubject(result.item)]) }
    const result = await searchContentSource('manga', query, undefined, searchHeaders(req), 20)
    const items = result.items.map(normalizedSubject)
    return items.length ? success(res, items) : error(res, `${result.rule.label} 没有返回匹配漫画`, 'SOURCE_EMPTY', 404)
  } catch (cause) { console.error('漫画源检索失败:', cause); return error(res, cause instanceof Error ? cause.message : '无法连接漫画数据源', 'SOURCE_UNAVAILABLE', 502) }
}function replaceSources(id: number, input: unknown) { const list = normalizeSources(input); db.prepare('DELETE FROM manga_read_sources WHERE manga_id=?').run(id); const insert = db.prepare('INSERT INTO manga_read_sources (manga_id,name,url,remark,is_default,sort_order) VALUES (?,?,?,?,?,?)'); list.forEach((source) => insert.run(id, source.name, source.url, source.remark, source.is_default ? 1 : 0, source.sort_order)) }
function status(value: unknown) { const item = clean(value, 30); return ['reading','finished','planned','paused'].includes(item) ? item : 'reading' }
export function create(req: AuthRequest, res: Response) {
  const title = clean(req.body?.title, 160); if (!title) return error(res, '漫画标题不能为空')
  const result = db.transaction(() => { const inserted = db.prepare('INSERT INTO manga_items (title,slug,original_title,author,cover,description,external_id,source,source_url,status,progress,rating,publication,sort_order,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(title, uniqueSlug(req.body?.slug || title), clean(req.body?.original_title, 160), clean(req.body?.author, 160), clean(req.body?.cover, 1000), clean(req.body?.description, 4000), clean(req.body?.external_id, 40), clean(req.body?.source, 40), validUrl(req.body?.source_url), status(req.body?.status), clean(req.body?.progress, 80), Math.max(0, Math.min(10, number(req.body?.rating))), clean(req.body?.publication, 80), Math.trunc(number(req.body?.sort_order)), req.body?.is_active === false ? 0 : 1); const id = Number(inserted.lastInsertRowid); replaceSources(id, req.body?.read_sources); return id })()
  return success(res, attach(db.prepare('SELECT * FROM manga_items WHERE id=?').get(result)), '漫画已添加')
}
export function update(req: AuthRequest, res: Response) {
  const id = Math.trunc(number(req.params.id)); const row = db.prepare('SELECT * FROM manga_items WHERE id=?').get(id) as any; if (!row) return error(res, '漫画不存在', 'NOT_FOUND', 404)
  const title = clean(req.body?.title ?? row.title, 160); if (!title) return error(res, '漫画标题不能为空')
  db.transaction(() => { db.prepare("UPDATE manga_items SET title=?,slug=?,original_title=?,author=?,cover=?,description=?,external_id=?,source=?,source_url=?,status=?,progress=?,rating=?,publication=?,sort_order=?,is_active=?,updated_at=datetime('now') WHERE id=?").run(title, uniqueSlug(req.body?.slug ?? row.slug, id), clean(req.body?.original_title ?? row.original_title, 160), clean(req.body?.author ?? row.author, 160), clean(req.body?.cover ?? row.cover, 1000), clean(req.body?.description ?? row.description, 4000), clean(req.body?.external_id ?? row.external_id, 40), clean(req.body?.source ?? row.source, 40), validUrl(req.body?.source_url ?? row.source_url), status(req.body?.status ?? row.status), clean(req.body?.progress ?? row.progress, 80), Math.max(0, Math.min(10, number(req.body?.rating ?? row.rating))), clean(req.body?.publication ?? row.publication, 80), Math.trunc(number(req.body?.sort_order ?? row.sort_order)), req.body?.is_active === undefined ? row.is_active : (req.body.is_active ? 1 : 0), id); if (req.body?.read_sources !== undefined) replaceSources(id, req.body.read_sources) })()
  return success(res, attach(db.prepare('SELECT * FROM manga_items WHERE id=?').get(id)), '漫画已保存')
}
export function remove(req: AuthRequest, res: Response) { const result = db.prepare('DELETE FROM manga_items WHERE id=?').run(Math.trunc(number(req.params.id))); return result.changes ? success(res, null, '漫画已删除') : error(res, '漫画不存在', 'NOT_FOUND', 404) }