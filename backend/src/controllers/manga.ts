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
const pagePattern = /\.(?:jpe?g|png|webp|gif|avif|bmp|pdf)$/i
const unsupportedArchivePattern = /\.(?:cbr|rar|cb7|7z|cbt|tar|mobi|azw3?|kf8|prc)$/i
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

type MangaPageSource = { relativePath: string; originalName: string; writeTo(target: string): void }
type MangaImportGroup = { volume: string; chapter: string; items: MangaPageSource[] }
function cleanImportParts(value: string) {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter((part) => part && part !== '.' && part !== '..' && !part.startsWith('.'))
}
function pageGroups(items: MangaPageSource[], packageName: string, fallbackVolume: string): MangaImportGroup[] {
  let entries = items.map((item) => ({ item, parts: cleanImportParts(item.relativePath) })).filter((entry) => entry.parts.length)
  if (!entries.length) throw new Error('文件中没有可用图片或 PDF 页面')
  const firstFolder = entries[0].parts[0]
  if (entries.every((entry) => entry.parts.length > 1 && entry.parts[0] === firstFolder)) entries = entries.map((entry) => ({ ...entry, parts: entry.parts.slice(1) }))
  const layered = entries.some((entry) => entry.parts.length >= 3)
  const groups = new Map<string, MangaImportGroup>()
  for (const entry of entries) {
    const folders = entry.parts.slice(0, -1)
    const volume = layered ? (folders[0] || fallbackVolume) : fallbackVolume
    const chapter = layered ? (folders.slice(1).join(' / ') || packageName) : (folders.join(' / ') || packageName)
    const key = volume + '\u0000' + chapter
    if (!groups.has(key)) groups.set(key, { volume, chapter, items: [] })
    groups.get(key)!.items.push(entry.item)
  }
  return [...groups.values()].sort((a, b) => natural.compare(a.volume, b.volume) || natural.compare(a.chapter, b.chapter)).map((group) => ({ ...group, items: group.items.sort((a, b) => natural.compare(a.relativePath, b.relativePath)) }))
}
function shouldKeepEpubImage(name: string) {
  const normalized = name.toLowerCase()
  return pagePattern.test(normalized) && !/(?:^|\/)(?:icon|logo|banner|button|bg|background|mask|shadow|spacer|blank|ad)[-_\.]/i.test(normalized) && !/\.svg$/i.test(normalized)
}
function resolveZipPath(from: string, target: string) {
  const base = from.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
  return cleanImportParts((base ? base + '/' : '') + target.split('#')[0].split('?')[0]).join('/')
}
function entrySize(entry: AdmZip.IZipEntry) {
  const header = entry.header as unknown as { size?: number; compressedSize?: number }
  return Number(header.size || header.compressedSize || 0)
}
function epubGroups(file: Express.Multer.File, fallbackVolume: string) {
  const zip = new AdmZip(file.path)
  const byName = new Map(zip.getEntries().filter((entry) => !entry.isDirectory).map((entry) => [entry.entryName.replace(/\\/g, '/').replace(/^\/+/, ''), entry]))
  const docs = zip.getEntries().filter((entry) => !entry.isDirectory && /\.(?:xhtml|html|htm)$/i.test(entry.entryName)).sort((a, b) => natural.compare(a.entryName, b.entryName))
  const used = new Set<string>()
  const items: MangaPageSource[] = []
  for (const doc of docs) {
    const html = doc.getData().toString('utf8')
    const candidates = [...html.matchAll(/<(?:img|image)\b[^>]*(?:src|href|xlink:href)=['"]([^'"]+)['"][^>]*>/gi)]
      .map((match) => resolveZipPath(doc.entryName, match[1]))
      .map((ref) => ({ ref, entry: byName.get(ref) }))
      .filter((item): item is { ref: string; entry: AdmZip.IZipEntry } => Boolean(item.entry) && !used.has(item.ref) && shouldKeepEpubImage(item.ref))
      .sort((a, b) => entrySize(b.entry) - entrySize(a.entry))
    const picked = candidates[0]
    if (!picked) continue
    used.add(picked.ref)
    items.push({ relativePath: doc.entryName.replace(/\.(?:xhtml|html|htm)$/i, '/' + path.basename(picked.ref)), originalName: path.basename(picked.ref), writeTo(target: string) { fs.writeFileSync(target, picked.entry.getData()) } })
  }
  if (!items.length) return archiveGroups(file, fallbackVolume)
  return pageGroups(items, path.parse(file.originalname).name, fallbackVolume)
}
function archiveGroups(file: Express.Multer.File, fallbackVolume: string) {
  if (unsupportedArchivePattern.test(file.originalname)) throw new Error('MOBI/AZW 与 CBR/RAR、CB7/7Z、CBT/TAR 需要独立转换/解压服务；请先转为 CBZ/ZIP、图片型 EPUB，或上传 PDF/图片。')
  const zip = new AdmZip(file.path)
  const items = zip.getEntries().filter((entry) => !entry.isDirectory && pagePattern.test(entry.entryName) && !entry.entryName.includes('__MACOSX')).map((entry) => ({ relativePath: entry.entryName, originalName: path.basename(entry.entryName), writeTo(target: string) { fs.writeFileSync(target, entry.getData()) } }))
  return pageGroups(items, path.parse(file.originalname).name, fallbackVolume)
}
function uploadedMangaFiles(req: AuthRequest) {
  const files: Express.Multer.File[] = []
  if (req.file) files.push(req.file)
  const source = req.files as Express.Multer.File[] | Record<string, Express.Multer.File[]> | undefined
  if (Array.isArray(source)) files.push(...source)
  else if (source) Object.values(source).forEach((list) => files.push(...list))
  return files
}
function looseFileGroups(files: Express.Multer.File[], fallbackVolume: string) {
  if (files.some((file) => unsupportedArchivePattern.test(file.originalname))) throw new Error('MOBI/AZW 与 CBR/RAR、CB7/7Z、CBT/TAR 需要独立转换/解压服务；请先转为 CBZ/ZIP、图片型 EPUB，或上传 PDF/图片。')
  const archives = files.filter((file) => /\.(?:cbz|zip|epub)$/i.test(file.originalname))
  if (archives.length > 1 || (archives.length && files.length > 1)) throw new Error('一次只能导入一个 CBZ/ZIP/EPUB；多张图片或 PDF 请不要和压缩包混选。')
  if (archives[0]) return /\.epub$/i.test(archives[0].originalname) ? epubGroups(archives[0], fallbackVolume) : archiveGroups(archives[0], fallbackVolume)
  const pages = files.filter((file) => pagePattern.test(file.originalname)).map((file) => ({ relativePath: file.originalname, originalName: file.originalname, writeTo(target: string) { fs.copyFileSync(file.path, target) } }))
  return pageGroups(pages, files.length === 1 ? path.parse(files[0].originalname).name : '散图导入', fallbackVolume)
}
export function importLocal(req: AuthRequest, res: Response) {
  const uploaded=uploadedMangaFiles(req)
  if(!uploaded.length) return error(res,'请选择漫画文件','VALIDATION_ERROR')
  const requestedId=integer(req.body?.manga_id),existing=requestedId?db.prepare("SELECT * FROM manga_items WHERE id=? AND library_type='local'").get(requestedId) as any:null
  if(requestedId&&!existing){uploaded.forEach((file)=>fs.rmSync(file.path,{force:true}));return error(res,'要追加的本地漫画不存在','NOT_FOUND',404)}
  const title=clean(req.body?.title||existing?.title||path.parse(uploaded[0].originalname).name,160),author=clean(req.body?.author||existing?.author,160),fallbackVolume=clean(req.body?.volume_title,160)||'正文'
  let groups:MangaImportGroup[];try{groups=looseFileGroups(uploaded,fallbackVolume)}catch(cause){uploaded.forEach((file)=>fs.rmSync(file.path,{force:true}));return error(res,cause instanceof Error?cause.message:'漫画文件解析失败','IMPORT_FAILED')}
  const slug=existing?.slug||uniqueSlug(req.body?.slug||title),relativeRoot=`manga/${slug}-${Date.now()}`,absoluteRoot=path.join(config.uploadDir,...relativeRoot.split('/'))
  try{
    fs.mkdirSync(absoluteRoot,{recursive:true});let firstCover=''
    const mangaId=db.transaction(()=>{
      let mangaId=requestedId
      if(!mangaId){const inserted=db.prepare("INSERT INTO manga_items (title,slug,author,description,status,is_active,library_type,source) VALUES (?,?,?,?,?,1,'local','local-import')").run(title,slug,author,clean(req.body?.description,4000),status(req.body?.status));mangaId=Number(inserted.lastInsertRowid)}
      let volumeOrder=integer((db.prepare('SELECT MAX(sort_order) value FROM manga_volumes WHERE manga_id=?').get(mangaId) as any)?.value,-1)
      const chapterOrders=new Map<number,number>()
      for(const group of groups){
        let volume=db.prepare('SELECT * FROM manga_volumes WHERE manga_id=? AND title=?').get(mangaId,group.volume) as any
        if(!volume){volumeOrder++;const vr=db.prepare('INSERT INTO manga_volumes (manga_id,title,slug,sort_order) VALUES (?,?,?,?)').run(mangaId,group.volume,childSlug('manga_volumes',group.volume,'manga_id',mangaId),volumeOrder);volume={id:Number(vr.lastInsertRowid),sort_order:volumeOrder}}
        let chapterOrder=chapterOrders.get(volume.id)
        if(chapterOrder===undefined)chapterOrder=integer((db.prepare('SELECT MAX(sort_order) value FROM manga_chapters WHERE volume_id=?').get(volume.id) as any)?.value,-1)+1
        const chapterTitle=db.prepare('SELECT 1 FROM manga_chapters WHERE volume_id=? AND title=?').get(volume.id,group.chapter)?`${group.chapter}（${new Date().toLocaleDateString('zh-CN')}）`:group.chapter
        const cr=db.prepare('INSERT INTO manga_chapters (volume_id,title,slug,sort_order,source_filename) VALUES (?,?,?,?,?)').run(volume.id,chapterTitle,childSlug('manga_chapters',chapterTitle,'volume_id',volume.id),chapterOrder,uploaded[0].originalname)
        const chapterId=Number(cr.lastInsertRowid),chapterDir=path.join(absoluteRoot,String(volume.sort_order+1),String(chapterOrder+1));chapterOrders.set(volume.id,chapterOrder+1);fs.mkdirSync(chapterDir,{recursive:true})
        group.items.forEach((item,index)=>{const ext=path.extname(item.originalName).toLowerCase()||'.jpg',filename=String(index+1).padStart(5,'0')+ext,target=path.join(chapterDir,filename);item.writeTo(target);const imageUrl=`/uploads/${relativeRoot}/${volume.sort_order+1}/${chapterOrder!+1}/${filename}`;if(!firstCover)firstCover=imageUrl;db.prepare('INSERT INTO manga_pages (chapter_id,image_url,sort_order) VALUES (?,?,?)').run(chapterId,imageUrl,index)})
      }
      db.prepare("UPDATE manga_items SET cover=CASE WHEN cover='' THEN ? ELSE cover END,updated_at=datetime('now') WHERE id=?").run(firstCover,mangaId)
      return mangaId
    })()
    return success(res,attach(db.prepare('SELECT * FROM manga_items WHERE id=?').get(mangaId),true),existing?`已追加 ${groups.length} 章漫画`:`已导入 ${groups.length} 章漫画`)
  }catch(cause){fs.rmSync(absoluteRoot,{recursive:true,force:true});console.error('本地漫画导入失败:',cause);return error(res,cause instanceof Error?cause.message:'本地漫画导入失败','IMPORT_FAILED',500)}finally{uploaded.forEach((file)=>fs.rmSync(file.path,{force:true}))}
}
export function getReadingState(req: DeviceRequest,res: Response){const row=db.prepare('SELECT * FROM manga_reading_states WHERE user_id=? AND manga_id=?').get(req.deviceUserId!,integer(req.params.mangaId)) as any;if(row)row.settings=json(row.settings);return success(res,row||null)}
export function putReadingState(req: DeviceRequest,res: Response){const userId=req.deviceUserId!,mangaId=integer(req.params.mangaId);if(!db.prepare("SELECT 1 FROM manga_items WHERE id=? AND library_type='local'").get(mangaId))return error(res,'本地漫画不存在','NOT_FOUND',404);const current=db.prepare('SELECT * FROM manga_reading_states WHERE user_id=? AND manga_id=?').get(userId,mangaId) as any,base=integer(req.body?.revision),sameDevice=Boolean(current&&Number(current.device_id)===Number(req.deviceId));if(current&&base!==current.revision&&!sameDevice&&!req.body?.force)return res.status(409).json({success:false,code:'READING_CONFLICT',message:'另一台设备已有更新，请选择保留哪一份进度',data:{server:current,submitted:req.body}});const revision=(current?.revision||0)+1;db.prepare("INSERT INTO manga_reading_states (user_id,manga_id,volume_id,chapter_id,page_index,mode,settings,revision,device_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(user_id,manga_id) DO UPDATE SET volume_id=excluded.volume_id,chapter_id=excluded.chapter_id,page_index=excluded.page_index,mode=excluded.mode,settings=excluded.settings,revision=excluded.revision,device_id=excluded.device_id,updated_at=datetime('now')").run(userId,mangaId,integer(req.body?.volume_id)||null,integer(req.body?.chapter_id)||null,Math.max(0,integer(req.body?.page_index)),req.body?.mode==='paged'?'paged':'scroll',JSON.stringify(req.body?.settings&&typeof req.body.settings==='object'?req.body.settings:{}),revision,req.deviceId!);return success(res,{revision},'漫画进度已同步')}
export function privateLibrary(req: DeviceRequest,res: Response){const rows=db.prepare("SELECT m.id,m.slug,m.title,m.cover,s.volume_id,s.chapter_id,s.page_index,s.mode,s.updated_at progress_updated_at,v.slug volume_slug,v.title volume_title,c.slug chapter_slug,c.title chapter_title,(SELECT COUNT(*) FROM manga_pages p WHERE p.chapter_id=c.id) page_count FROM manga_reading_states s JOIN manga_items m ON m.id=s.manga_id LEFT JOIN manga_volumes v ON v.id=s.volume_id LEFT JOIN manga_chapters c ON c.id=s.chapter_id WHERE s.user_id=? AND m.is_active=1 ORDER BY s.updated_at DESC").all(req.deviceUserId!) as any[];return success(res,rows)}