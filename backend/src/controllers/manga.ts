import { Response } from 'express'
import AdmZip from 'adm-zip'
import fs from 'fs'
import path from 'path'
import db from '../config/database'
import { config } from '../config'
import { AuthRequest } from '../middleware/auth'
import { DeviceRequest } from '../middleware/device'
import { detailContentSource, NormalizedContentSubject, searchContentSource } from '../services/content-search-sources'
import { success, error } from '../utils/response'

const browserUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const imagePattern = /\.(?:jpe?g|png|webp|gif|avif|bmp)$/i
const natural = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })
function clean(value: unknown, max = 500) { return String(value ?? '').trim().slice(0, max) }
function number(value: unknown, fallback = 0) { const result = Number(value); return Number.isFinite(result) ? result : fallback }
function integer(value: unknown, fallback = 0) { return Math.trunc(number(value, fallback)) }
function slugify(value: unknown) { return clean(value, 180).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'manga' }
function uniqueSlug(value: unknown, exclude = 0) { const base = slugify(value); let slug = base, index = 2; while (db.prepare('SELECT 1 FROM manga_items WHERE slug=? AND id!=?').get(slug, exclude)) slug = `${base}-${index++}`; return slug }
function childSlug(table: 'manga_volumes'|'manga_chapters', value: unknown, parentColumn: 'manga_id'|'volume_id', parentId: number) { const base=slugify(value); let slug=base,index=2; while(db.prepare(`SELECT 1 FROM ${table} WHERE ${parentColumn}=? AND slug=?`).get(parentId,slug)) slug=`${base}-${index++}`; return slug }
function validUrl(value: unknown) { const url = clean(value, 1000); return /^https?:\/\//i.test(url) ? url : '' }
function libraryType(value: unknown) { return value === 'local' ? 'local' : 'network' }
function status(value: unknown) { const item = clean(value, 30); return ['reading','finished','planned','paused'].includes(item) ? item : 'reading' }
function json(value: unknown) { try { return JSON.parse(String(value || '{}')) } catch { return {} } }
function normalizeSources(input: unknown) {
  const list = Array.isArray(input) ? input : []
  let defaultUsed = false
  return list.map((source: any, index) => ({ name: clean(source?.name, 60) || `阅读源 ${index + 1}`, url: validUrl(source?.url), remark: clean(source?.remark, 120), is_default: Boolean(source?.is_default) && !defaultUsed, sort_order: integer(source?.sort_order, index) })).filter((source) => source.url).map((source, index) => { if (source.is_default) defaultUsed = true; if (!defaultUsed && index === 0) { source.is_default = true; defaultUsed = true } return source }).slice(0, 20)
}
function sources(id: number) { return db.prepare('SELECT id,manga_id,name,url,remark,is_default,sort_order FROM manga_read_sources WHERE manga_id=? ORDER BY is_default DESC,sort_order,id').all(id) }
function hierarchy(id: number) {
  const volumes=db.prepare('SELECT v.*, (SELECT COUNT(*) FROM manga_chapters c WHERE c.volume_id=v.id) chapter_count FROM manga_volumes v WHERE v.manga_id=? ORDER BY v.sort_order,v.id').all(id) as any[]
  for(const volume of volumes) volume.chapters=db.prepare('SELECT c.*, (SELECT COUNT(*) FROM manga_pages p WHERE p.chapter_id=c.id) page_count FROM manga_chapters c WHERE c.volume_id=? ORDER BY c.sort_order,c.id').all(volume.id)
  return volumes
}
function attach(row: any, full=false) { if (!row) return row; row.read_sources = sources(row.id); if(full && row.library_type==='local') row.volumes=hierarchy(row.id); return row }
function listSelect(where = '') { return `SELECT m.*, (SELECT COUNT(*) FROM manga_volumes v WHERE v.manga_id=m.id) volume_count, (SELECT COUNT(*) FROM manga_chapters c JOIN manga_volumes v ON v.id=c.volume_id WHERE v.manga_id=m.id) chapter_count FROM manga_items m ${where}` }

export function publicList(req: AuthRequest, res: Response) { const type=clean(req.query.type,20); const clause=type==='local'||type==='network'?'WHERE is_active=1 AND library_type=? ORDER BY sort_order,id DESC':'WHERE is_active=1 ORDER BY library_type,sort_order,id DESC'; const rows=(type==='local'||type==='network'?db.prepare(listSelect(clause)).all(type):db.prepare(listSelect(clause)).all()) as any[]; return success(res, rows.map((row)=>attach(row))) }
export function publicDetail(req: AuthRequest, res: Response) { const row = db.prepare(listSelect('WHERE slug=? AND is_active=1')).get(clean(req.params.slug, 180)); return row ? success(res, attach(row,true)) : error(res, '漫画不存在', 'NOT_FOUND', 404) }
export function publicChapter(req: AuthRequest, res: Response) {
  const manga=db.prepare("SELECT * FROM manga_items WHERE slug=? AND library_type='local' AND is_active=1").get(clean(req.params.slug,180)) as any
  if(!manga) return error(res,'本地漫画不存在','NOT_FOUND',404)
  const chapter=db.prepare('SELECT c.*,v.id volume_id,v.title volume_title,v.slug volume_slug FROM manga_chapters c JOIN manga_volumes v ON v.id=c.volume_id WHERE v.manga_id=? AND v.slug=? AND c.slug=?').get(manga.id,clean(req.params.volume,180),clean(req.params.chapter,180)) as any
  if(!chapter) return error(res,'漫画章节不存在','NOT_FOUND',404)
  chapter.pages=db.prepare('SELECT id,image_url,sort_order FROM manga_pages WHERE chapter_id=? ORDER BY sort_order,id').all(chapter.id)
  const navigation=db.prepare('SELECT c.id,c.title,c.slug,c.sort_order,v.id volume_id,v.title volume_title,v.slug volume_slug,(SELECT COUNT(*) FROM manga_pages p WHERE p.chapter_id=c.id) page_count FROM manga_chapters c JOIN manga_volumes v ON v.id=c.volume_id WHERE v.manga_id=? ORDER BY v.sort_order,v.id,c.sort_order,c.id').all(manga.id)
  return success(res,{manga,chapter,navigation})
}
export function list(_req: AuthRequest, res: Response) { return success(res, (db.prepare(listSelect('ORDER BY library_type,sort_order,id DESC')).all() as any[]).map((row)=>attach(row,true))) }

function normalizedSubject(item: NormalizedContentSubject) { return { external_id: item.external_id, source: item.source, source_label: item.source_label, title: item.title, original_title: item.original_title, author: '', cover: item.cover, source_url: item.source_url, rating: item.rating, publication: item.publication, description: item.description, library_type:'network' } }
function searchHeaders(req: AuthRequest) { const incoming = clean(req.get('user-agent'), 500); return { 'User-Agent': /^Mozilla\/5\.0/i.test(incoming) ? incoming : browserUA, 'X-Application-User-Agent': 'new-blog/1.0.0 (https://github.com/3137283455/new-blog)' } }
export async function searchSource(req: AuthRequest, res: Response) {
  const query = clean(req.query.q, 100), id = clean(req.query.id, 80)
  if (!query && !id) return error(res, '请输入漫画名称或数据源 ID')
  try { if (id) { const result = await detailContentSource('manga', id, undefined, searchHeaders(req)); return success(res, [normalizedSubject(result.item)]) } const result = await searchContentSource('manga', query, undefined, searchHeaders(req), 20); const items = result.items.map(normalizedSubject); return items.length ? success(res, items) : error(res, `${result.rule.label} 没有返回匹配漫画`, 'SOURCE_EMPTY', 404) } catch (cause) { console.error('漫画源检索失败:', cause); return error(res, cause instanceof Error ? cause.message : '无法连接漫画数据源', 'SOURCE_UNAVAILABLE', 502) }
}
function replaceSources(id: number, input: unknown) { const list = normalizeSources(input); db.prepare('DELETE FROM manga_read_sources WHERE manga_id=?').run(id); const insert = db.prepare('INSERT INTO manga_read_sources (manga_id,name,url,remark,is_default,sort_order) VALUES (?,?,?,?,?,?)'); list.forEach((source) => insert.run(id, source.name, source.url, source.remark, source.is_default ? 1 : 0, source.sort_order)) }
export function create(req: AuthRequest, res: Response) {
  const title = clean(req.body?.title, 160); if (!title) return error(res, '漫画标题不能为空')
  const type=libraryType(req.body?.library_type)
  const result = db.transaction(() => { const inserted = db.prepare('INSERT INTO manga_items (title,slug,original_title,author,cover,description,external_id,source,source_url,status,progress,rating,publication,sort_order,is_active,library_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(title, uniqueSlug(req.body?.slug || title), clean(req.body?.original_title, 160), clean(req.body?.author, 160), clean(req.body?.cover, 1000), clean(req.body?.description, 4000), clean(req.body?.external_id, 40), clean(req.body?.source, 40), validUrl(req.body?.source_url), status(req.body?.status), clean(req.body?.progress, 80), Math.max(0, Math.min(10, number(req.body?.rating))), clean(req.body?.publication, 80), integer(req.body?.sort_order), req.body?.is_active === false ? 0 : 1,type); const id = Number(inserted.lastInsertRowid); if(type==='network')replaceSources(id, req.body?.read_sources); return id })()
  return success(res, attach(db.prepare('SELECT * FROM manga_items WHERE id=?').get(result),true), '漫画已添加')
}
export function update(req: AuthRequest, res: Response) {
  const id = integer(req.params.id); const row = db.prepare('SELECT * FROM manga_items WHERE id=?').get(id) as any; if (!row) return error(res, '漫画不存在', 'NOT_FOUND', 404)
  const title = clean(req.body?.title ?? row.title, 160); if (!title) return error(res, '漫画标题不能为空'); const type=libraryType(req.body?.library_type??row.library_type)
  db.transaction(() => { db.prepare("UPDATE manga_items SET title=?,slug=?,original_title=?,author=?,cover=?,description=?,external_id=?,source=?,source_url=?,status=?,progress=?,rating=?,publication=?,sort_order=?,is_active=?,library_type=?,updated_at=datetime('now') WHERE id=?").run(title, uniqueSlug(req.body?.slug ?? row.slug, id), clean(req.body?.original_title ?? row.original_title, 160), clean(req.body?.author ?? row.author, 160), clean(req.body?.cover ?? row.cover, 1000), clean(req.body?.description ?? row.description, 4000), clean(req.body?.external_id ?? row.external_id, 40), clean(req.body?.source ?? row.source, 40), validUrl(req.body?.source_url ?? row.source_url), status(req.body?.status ?? row.status), clean(req.body?.progress ?? row.progress, 80), Math.max(0, Math.min(10, number(req.body?.rating ?? row.rating))), clean(req.body?.publication ?? row.publication, 80), integer(req.body?.sort_order ?? row.sort_order), req.body?.is_active === undefined ? row.is_active : (req.body.is_active ? 1 : 0),type,id); if (type==='network'&&req.body?.read_sources !== undefined) replaceSources(id, req.body.read_sources) })()
  return success(res, attach(db.prepare('SELECT * FROM manga_items WHERE id=?').get(id),true), '漫画已保存')
}
export function remove(req: AuthRequest, res: Response) { const result = db.prepare('DELETE FROM manga_items WHERE id=?').run(integer(req.params.id)); return result.changes ? success(res, null, '漫画已删除') : error(res, '漫画不存在', 'NOT_FOUND', 404) }

function archiveGroups(file: Express.Multer.File, fallbackVolume: string) {
  const zip=new AdmZip(file.buffer)
  let items=zip.getEntries().filter((entry)=>!entry.isDirectory&&imagePattern.test(entry.entryName)&&!entry.entryName.includes('__MACOSX')).map((entry)=>({entry,path:entry.entryName.replace(/\\/g,'/').replace(/^\/+/, '').split('/').filter((part)=>part&&part!=='.'&&!part.startsWith('.'))})).filter((item)=>item.path.length&&item.path.every((part)=>part!=='..'))
  if(!items.length) throw new Error('压缩包中没有可用图片')
  const first=items[0].path[0]; if(items.every((item)=>item.path.length>1&&item.path[0]===first)) items=items.map((item)=>({...item,path:item.path.slice(1)}))
  const layered=items.some((item)=>item.path.length>=3)
  const groups=new Map<string,{volume:string;chapter:string;items:typeof items}>()
  for(const item of items){const folders=item.path.slice(0,-1); const volume=layered?(folders[0]||fallbackVolume):fallbackVolume; const chapter=layered?(folders.slice(1).join(' / ')||path.parse(file.originalname).name):(folders.join(' / ')||path.parse(file.originalname).name); const key=volume+'\u0000'+chapter; if(!groups.has(key))groups.set(key,{volume,chapter,items:[]}); groups.get(key)!.items.push(item)}
  return [...groups.values()].sort((a,b)=>natural.compare(a.volume,b.volume)||natural.compare(a.chapter,b.chapter)).map((group)=>({...group,items:group.items.sort((a,b)=>natural.compare(a.path.join('/'),b.path.join('/')))}))
}
export function importLocal(req: AuthRequest, res: Response) {
  if(!req.file) return error(res,'请选择 CBZ 或 ZIP 漫画包','VALIDATION_ERROR')
  const title=clean(req.body?.title||path.parse(req.file.originalname).name,160),author=clean(req.body?.author,160),fallbackVolume=clean(req.body?.volume_title,160)||'正文'
  let groups:ReturnType<typeof archiveGroups>; try{groups=archiveGroups(req.file,fallbackVolume)}catch(cause){return error(res,cause instanceof Error?cause.message:'漫画包解析失败','IMPORT_FAILED')}
  const slug=uniqueSlug(req.body?.slug||title), relativeRoot=`manga/${slug}-${Date.now()}`, absoluteRoot=path.join(config.uploadDir,...relativeRoot.split('/'))
  try{
    fs.mkdirSync(absoluteRoot,{recursive:true}); let firstCover='';
    const mangaId=db.transaction(()=>{const inserted=db.prepare("INSERT INTO manga_items (title,slug,author,description,status,is_active,library_type,source) VALUES (?,?,?,?,?,1,'local','local-import')").run(title,slug,author,clean(req.body?.description,4000),status(req.body?.status)); const mangaId=Number(inserted.lastInsertRowid); let volumeOrder=-1,lastVolume='',volumeId=0,chapterOrder=0; for(const group of groups){if(group.volume!==lastVolume){lastVolume=group.volume;volumeOrder++;chapterOrder=0;const vr=db.prepare('INSERT INTO manga_volumes (manga_id,title,slug,sort_order) VALUES (?,?,?,?)').run(mangaId,group.volume,childSlug('manga_volumes',group.volume,'manga_id',mangaId),volumeOrder);volumeId=Number(vr.lastInsertRowid)} const cr=db.prepare('INSERT INTO manga_chapters (volume_id,title,slug,sort_order,source_filename) VALUES (?,?,?,?,?)').run(volumeId,group.chapter,childSlug('manga_chapters',group.chapter,'volume_id',volumeId),chapterOrder++,req.file!.originalname);const chapterId=Number(cr.lastInsertRowid),chapterDir=path.join(absoluteRoot,String(volumeOrder+1),String(chapterOrder));fs.mkdirSync(chapterDir,{recursive:true});group.items.forEach((item,index)=>{const ext=path.extname(item.path[item.path.length-1]).toLowerCase()||'.jpg',filename=String(index+1).padStart(5,'0')+ext,target=path.join(chapterDir,filename);fs.writeFileSync(target,item.entry.getData());const imageUrl=`/uploads/${relativeRoot}/${volumeOrder+1}/${chapterOrder}/${filename}`;if(!firstCover)firstCover=imageUrl;db.prepare('INSERT INTO manga_pages (chapter_id,image_url,sort_order) VALUES (?,?,?)').run(chapterId,imageUrl,index)})} db.prepare("UPDATE manga_items SET cover=?,updated_at=datetime('now') WHERE id=?").run(firstCover,mangaId);return mangaId})(); return success(res,attach(db.prepare('SELECT * FROM manga_items WHERE id=?').get(mangaId),true),`已导入 ${groups.length} 章漫画`)
  }catch(cause){fs.rmSync(absoluteRoot,{recursive:true,force:true});console.error('本地漫画导入失败:',cause);return error(res,cause instanceof Error?cause.message:'本地漫画导入失败','IMPORT_FAILED',500)}
}
export function getReadingState(req: DeviceRequest,res: Response){const row=db.prepare('SELECT * FROM manga_reading_states WHERE user_id=? AND manga_id=?').get(req.deviceUserId!,integer(req.params.mangaId)) as any;if(row)row.settings=json(row.settings);return success(res,row||null)}
export function putReadingState(req: DeviceRequest,res: Response){const userId=req.deviceUserId!,mangaId=integer(req.params.mangaId);if(!db.prepare("SELECT 1 FROM manga_items WHERE id=? AND library_type='local'").get(mangaId))return error(res,'本地漫画不存在','NOT_FOUND',404);const current=db.prepare('SELECT * FROM manga_reading_states WHERE user_id=? AND manga_id=?').get(userId,mangaId) as any,base=integer(req.body?.revision),sameDevice=Boolean(current&&Number(current.device_id)===Number(req.deviceId));if(current&&base!==current.revision&&!sameDevice&&!req.body?.force)return res.status(409).json({success:false,code:'READING_CONFLICT',message:'另一台设备已有更新，请选择保留哪一份进度',data:{server:current,submitted:req.body}});const revision=(current?.revision||0)+1;db.prepare("INSERT INTO manga_reading_states (user_id,manga_id,volume_id,chapter_id,page_index,mode,settings,revision,device_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(user_id,manga_id) DO UPDATE SET volume_id=excluded.volume_id,chapter_id=excluded.chapter_id,page_index=excluded.page_index,mode=excluded.mode,settings=excluded.settings,revision=excluded.revision,device_id=excluded.device_id,updated_at=datetime('now')").run(userId,mangaId,integer(req.body?.volume_id)||null,integer(req.body?.chapter_id)||null,Math.max(0,integer(req.body?.page_index)),req.body?.mode==='paged'?'paged':'scroll',JSON.stringify(req.body?.settings&&typeof req.body.settings==='object'?req.body.settings:{}),revision,req.deviceId!);return success(res,{revision},'漫画进度已同步')}
export function privateLibrary(req: DeviceRequest,res: Response){const rows=db.prepare("SELECT m.id,m.slug,m.title,m.cover,s.volume_id,s.chapter_id,s.page_index,s.mode,s.updated_at progress_updated_at,v.slug volume_slug,v.title volume_title,c.slug chapter_slug,c.title chapter_title,(SELECT COUNT(*) FROM manga_pages p WHERE p.chapter_id=c.id) page_count FROM manga_reading_states s JOIN manga_items m ON m.id=s.manga_id LEFT JOIN manga_volumes v ON v.id=s.volume_id LEFT JOIN manga_chapters c ON c.id=s.chapter_id WHERE s.user_id=? AND m.is_active=1 ORDER BY s.updated_at DESC").all(req.deviceUserId!) as any[];return success(res,rows)}