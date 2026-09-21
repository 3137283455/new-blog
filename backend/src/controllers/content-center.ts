import { Response } from 'express'
import { createHash } from 'node:crypto'
import db from '../config/database'
import { AuthRequest } from '../middleware/auth'
import { DeviceRequest } from '../middleware/device'
import { error, success } from '../utils/response'
import { publicRelations, relationTargetExists } from '../services/content-relations'
import { fetchWeb } from '../services/web-fetch'

const clean=(value:unknown,max=500)=>String(value??'').trim().slice(0,max)
const integer=(value:unknown,fallback=0)=>Number.isFinite(Number(value))?Math.trunc(Number(value)):fallback
const json=(value:unknown)=>{try{return JSON.parse(String(value||'{}'))}catch{return {}}}

function pruneImportJobs() {
  db.prepare('DELETE FROM content_import_jobs WHERE id NOT IN (SELECT id FROM content_import_jobs ORDER BY id DESC LIMIT 4)').run()
}

function subscriptionSignature(bytes: Buffer, type: string, headers: Record<string, unknown> = {}) {
  const text = bytes.toString('utf8').replace(/\s+/g, ' ').trim()
  let stable = ''
  if (/json/i.test(type)) {
    try {
      const feed = JSON.parse(text)
      const latest = Array.isArray(feed?.items) ? feed.items[0] : null
      stable = latest ? JSON.stringify({ id: latest.id, url: latest.url, title: latest.title, date_modified: latest.date_modified, date_published: latest.date_published }) : ''
    } catch { /* fall through to XML or document signature */ }
  }
  if (!stable && /<(rss|feed|rdf:)/i.test(text)) {
    stable = text.match(/<(item|entry)\b[\s\S]*?<\/\1>/i)?.[0] || ''
  }
  if (!stable) stable = String(headers.etag || headers['last-modified'] || text)
  return createHash('sha256').update(stable.slice(0, 1_000_000)).digest('hex')
}

async function refreshSubscription(row: any) {
  const response = await fetchWeb(row.url, 1024 * 1024)
  const signature = subscriptionSignature(response.bytes, response.type, response.headers as Record<string, unknown>)
  const changed = Boolean(row.last_signature && row.last_signature !== signature)
  db.prepare(`UPDATE content_subscriptions
    SET last_signature=?, last_checked_at=datetime('now'),
        last_changed_at=CASE WHEN ? THEN datetime('now') ELSE last_changed_at END,
        unread_count=unread_count+?, updated_at=datetime('now')
    WHERE id=?`).run(signature, changed ? 1 : 0, changed ? 1 : 0, row.id)
  return { ...(db.prepare('SELECT * FROM content_subscriptions WHERE id=?').get(row.id) as any), changed }
}

export function importJobs(_req:AuthRequest,res:Response){pruneImportJobs();const rows=db.prepare('SELECT * FROM content_import_jobs ORDER BY id DESC LIMIT 4').all() as any[];rows.forEach(row=>row.options=json(row.options));return success(res,rows)}
export function createImportJob(req:AuthRequest,res:Response){const filename=clean(req.body?.filename,255);if(!filename)return error(res,'缺少文件名','VALIDATION_ERROR');const kind=['book','manga','media'].includes(req.body?.kind)?req.body.kind:'unknown';const result=db.prepare('INSERT INTO content_import_jobs (user_id,kind,filename,status,progress,options) VALUES (?,?,?,?,?,?)').run(req.userId||null,kind,filename,'pending',0,JSON.stringify(req.body?.options||{}));pruneImportJobs();return success(res,db.prepare('SELECT * FROM content_import_jobs WHERE id=?').get(result.lastInsertRowid))}
export function updateImportJob(req:AuthRequest,res:Response){const id=integer(req.params.id),current=db.prepare('SELECT * FROM content_import_jobs WHERE id=?').get(id) as any;if(!current)return error(res,'导入任务不存在','NOT_FOUND',404);const status=['pending','processing','completed','failed','cancelled'].includes(req.body?.status)?req.body.status:current.status;db.prepare("UPDATE content_import_jobs SET status=?,progress=?,result_type=?,result_id=?,error=?,options=?,updated_at=datetime('now') WHERE id=?").run(status,Math.max(0,Math.min(100,integer(req.body?.progress,current.progress))),clean(req.body?.result_type??current.result_type,30),integer(req.body?.result_id,current.result_id)||null,clean(req.body?.error??current.error,2000),JSON.stringify(req.body?.options??json(current.options)),id);pruneImportJobs();return success(res,db.prepare('SELECT * FROM content_import_jobs WHERE id=?').get(id))}
export function subscriptions(req:AuthRequest,res:Response){return success(res,db.prepare('SELECT * FROM content_subscriptions WHERE user_id=? ORDER BY is_active DESC,unread_count DESC,updated_at DESC').all(req.userId))}
export function createSubscription(req:AuthRequest,res:Response){const title=clean(req.body?.title,160),url=clean(req.body?.url,1000);if(!title||!/^https?:\/\//i.test(url))return error(res,'请输入名称和有效网址','VALIDATION_ERROR');try{const result=db.prepare('INSERT INTO content_subscriptions (user_id,kind,title,url,icon,check_interval) VALUES (?,?,?,?,?,?)').run(req.userId,clean(req.body?.kind,30)||'web',title,url,clean(req.body?.icon,1000),Math.max(15,integer(req.body?.check_interval,360)));return success(res,db.prepare('SELECT * FROM content_subscriptions WHERE id=?').get(result.lastInsertRowid))}catch{return error(res,'该订阅已经存在','DUPLICATE',409)}}
export function updateSubscription(req:AuthRequest,res:Response){const id=integer(req.params.id),row=db.prepare('SELECT * FROM content_subscriptions WHERE id=? AND user_id=?').get(id,req.userId) as any;if(!row)return error(res,'订阅不存在','NOT_FOUND',404);db.prepare("UPDATE content_subscriptions SET title=?,url=?,kind=?,icon=?,check_interval=?,unread_count=?,is_active=?,updated_at=datetime('now') WHERE id=?").run(clean(req.body?.title??row.title,160),clean(req.body?.url??row.url,1000),clean(req.body?.kind??row.kind,30),clean(req.body?.icon??row.icon,1000),Math.max(15,integer(req.body?.check_interval,row.check_interval)),Math.max(0,integer(req.body?.unread_count,row.unread_count)),req.body?.is_active===undefined?row.is_active:(req.body.is_active?1:0),id);return success(res,db.prepare('SELECT * FROM content_subscriptions WHERE id=?').get(id))}
export function removeSubscription(req:AuthRequest,res:Response){const result=db.prepare('DELETE FROM content_subscriptions WHERE id=? AND user_id=?').run(integer(req.params.id),req.userId);return result.changes?success(res,null,'订阅已删除'):error(res,'订阅不存在','NOT_FOUND',404)}
export async function checkSubscription(req:AuthRequest,res:Response){const row=db.prepare('SELECT * FROM content_subscriptions WHERE id=? AND user_id=?').get(integer(req.params.id),req.userId) as any;if(!row)return error(res,'订阅不存在','NOT_FOUND',404);try{return success(res,await refreshSubscription(row),row.last_signature?'订阅检查完成':'已建立更新基线')}catch(cause){return error(res,cause instanceof Error?cause.message:'订阅检查失败','SUBSCRIPTION_CHECK_FAILED',400)}}
export async function checkSubscriptions(req:AuthRequest,res:Response){const rows=db.prepare('SELECT * FROM content_subscriptions WHERE user_id=? AND is_active=1 ORDER BY updated_at DESC LIMIT 50').all(req.userId) as any[];const results=[] as any[];for(const row of rows){try{results.push(await refreshSubscription(row))}catch(cause){results.push({...row,check_error:cause instanceof Error?cause.message:'检查失败'})}}return success(res,results,`已检查 ${rows.length} 个订阅`)}
export function relations(req:AuthRequest,res:Response){const type=clean(req.query.type,30),id=integer(req.query.id);const rows=(type&&id?db.prepare('SELECT * FROM content_relations WHERE (source_type=? AND source_id=?) OR (target_type=? AND target_id=?) ORDER BY sort_order,id').all(type,id,type,id):db.prepare('SELECT * FROM content_relations ORDER BY id DESC LIMIT 200').all()) as any[];return success(res,rows.map((row)=>({...row,source_title:(db.prepare('SELECT title FROM search_documents WHERE kind=? AND source_id=?').get(row.source_type,row.source_id) as any)?.title||`#${row.source_id}`,target_title:(db.prepare('SELECT title FROM search_documents WHERE kind=? AND source_id=?').get(row.target_type,row.target_id) as any)?.title||`#${row.target_id}`})))}
export function publicRelationList(req:AuthRequest,res:Response){const type=clean(req.query.type,30),id=integer(req.query.id);if(!type||!id)return error(res,'缺少内容标识','VALIDATION_ERROR');return success(res,publicRelations(type,id))}
export function createRelation(req:AuthRequest,res:Response){const sourceType=clean(req.body?.source_type,30),targetType=clean(req.body?.target_type,30),sourceId=integer(req.body?.source_id),targetId=integer(req.body?.target_id),relationType=clean(req.body?.relation_type,30)||'related';const allowed=['article','page','navigation','bangumi','album','album-photo','music','book','manga','series'];if(!allowed.includes(sourceType)||!allowed.includes(targetType)||!sourceId||!targetId||(sourceType===targetType&&sourceId===targetId))return error(res,'请选择有效的两个不同内容','VALIDATION_ERROR');if(!relationTargetExists(sourceType,sourceId)||!relationTargetExists(targetType,targetId))return error(res,'关联内容不存在','NOT_FOUND',404);if(!['related','review','adaptation','soundtrack'].includes(relationType))return error(res,'关系类型无效','VALIDATION_ERROR');try{const result=db.prepare('INSERT INTO content_relations (source_type,source_id,target_type,target_id,relation_type,note,sort_order) VALUES (?,?,?,?,?,?,?)').run(sourceType,sourceId,targetType,targetId,relationType,clean(req.body?.note,500),integer(req.body?.sort_order));return success(res,db.prepare('SELECT * FROM content_relations WHERE id=?').get(result.lastInsertRowid))}catch{return error(res,'这条关系已经存在','DUPLICATE',409)}}
export function removeRelation(req:AuthRequest,res:Response){const result=db.prepare('DELETE FROM content_relations WHERE id=?').run(integer(req.params.id));return result.changes?success(res,null,'内容关系已删除'):error(res,'内容关系不存在','NOT_FOUND',404)}
export function readingCenter(req:DeviceRequest,res:Response){
  const books=db.prepare("SELECT 'book' kind,b.id,b.slug,b.title,b.cover,b.reading_mode,b.source_format,s.position progress,s.settings,s.updated_at,v.title section_title,c.title chapter_title,CASE WHEN b.reading_mode='document' THEN ('/books/'||b.slug||'/read') ELSE ('/books/'||b.slug||'/'||v.slug||'/'||c.slug) END href FROM reading_states s JOIN books b ON b.id=s.book_id LEFT JOIN book_volumes v ON v.id=s.volume_id LEFT JOIN book_chapters c ON c.id=s.chapter_id WHERE s.user_id=? AND b.deleted_at IS NULL").all(req.deviceUserId!) as any[]
  books.forEach((book)=>{
    const settings=json(book.settings)
    if(book.reading_mode==='document'){
      const page=Math.max(1,integer(settings?.pdfPage,1)), pages=Math.max(page,integer(settings?.pdfPages,page))
      book.section_title=String(book.source_format||'PDF').toUpperCase()
      book.chapter_title=`第 ${page} / ${pages} 页`
    }
    delete book.settings
  })
  const manga=db.prepare("SELECT 'manga' kind,m.id,m.slug,m.title,m.cover,CASE WHEN (SELECT COUNT(*) FROM manga_pages WHERE chapter_id=c.id)>1 THEN CAST(s.page_index AS REAL)/((SELECT COUNT(*) FROM manga_pages WHERE chapter_id=c.id)-1) ELSE 0 END progress,s.updated_at,v.title section_title,c.title chapter_title,('/manga/'||m.slug||'/'||v.slug||'/'||c.slug) href FROM manga_reading_states s JOIN manga_items m ON m.id=s.manga_id LEFT JOIN manga_volumes v ON v.id=s.volume_id LEFT JOIN manga_chapters c ON c.id=s.chapter_id WHERE s.user_id=? AND m.is_active=1").all(req.deviceUserId!) as any[]
  return success(res,[...books,...manga].sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))))
}
