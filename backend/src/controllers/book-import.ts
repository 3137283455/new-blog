import { Response } from 'express'
import crypto from 'crypto'
import db from '../config/database'
import { AuthRequest } from '../middleware/auth'
import { importEpub } from './epub'
import { success, error } from '../utils/response'

type Chapter = { title: string; html: string; sourceIndex: number }
type Volume = { title: string; sourceFilename: string; chapters: Chapter[] }
type Preview = { title: string; author: string; description: string; cover: string; volumes: Volume[]; createdAt: number }
const previews = new Map<string, Preview>()

function clean(value: unknown, max = 300) { return String(value ?? '').trim().slice(0, max) }
function slugify(value: unknown, fallback = 'item') {
  return clean(value, 180).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || fallback
}
function unique(table: 'books'|'book_volumes'|'book_chapters', baseValue: string, parent?: number) {
  const base=slugify(baseValue), sql=table==='books'?'SELECT 1 FROM books WHERE slug=?':table==='book_volumes'?'SELECT 1 FROM book_volumes WHERE book_id=? AND slug=?':'SELECT 1 FROM book_chapters WHERE volume_id=? AND slug=?'
  let value=base, index=2
  while(parent==null?db.prepare(sql).get(value):db.prepare(sql).get(parent,value)) value=base+'-'+index++
  return value
}
function parseWithLegacy(file: Express.Multer.File) {
  let payload: any
  const fakeRes: any = {
    statusCode: 200,
    status(code: number){ this.statusCode=code; return this },
    json(value: any){ payload=value; return value },
  }
  importEpub({ file } as any, fakeRes)
  if (!payload?.success) throw new Error(payload?.message || 'EPUB 解析失败')
  return payload.data
}
function chapterBodies(content: string, titles: Array<{title:string}>) {
  const sections: string[]=[]
  const re=/<section\b[^>]*data-epub-chapter[^>]*>([\s\S]*?)<\/section>/gi
  let match: RegExpExecArray|null
  while((match=re.exec(content))) sections.push(match[1])
  return titles.map((entry,index)=>{
    const body=(sections[index]||'').replace(/^\s*<h2\b[^>]*>[\s\S]*?<\/h2>/i,'').trim()
    return { title: clean(entry.title,200)||'第 '+(index+1)+' 章', html: body, sourceIndex:index }
  })
}
function volumeMarker(title: string) {
  const value=title.trim()
  return /(?:第\s*[0-9一二三四五六七八九十百零〇两]+\s*卷|卷\s*[0-9一二三四五六七八九十百零〇两]+|\bvol(?:ume)?[.\s_-]*\d+\b)/i.test(value)
}
function fileVolumeName(filename: string, fallback: string, multiple: boolean) {
  const plain=filename.replace(/\.epub$/i,'').trim()
  if(multiple) return plain || fallback || '未命名卷'
  if(plain && !/^(?:book|ebook|novel|full[-_ ]?book|正文|全文)$/i.test(plain)) return plain
  return fallback || '全书'
}
function splitVolumes(chapters: Chapter[], filename: string, fallback: string, multiple: boolean): Volume[] {
  const markers=chapters.map((chapter,index)=>volumeMarker(chapter.title)?index:-1).filter(index=>index>=0)
  if(!markers.length) return [{title:fileVolumeName(filename,fallback,multiple),sourceFilename:filename,chapters}]
  return markers.map((markerIndex,index)=>{
    const start=index===0?0:markerIndex
    const end=markers[index+1]??chapters.length
    return {title:chapters[markerIndex].title,sourceFilename:filename,chapters:chapters.slice(start,end)}
  }).filter(volume=>volume.chapters.length)
}
function cleanup(){
  const expiry=Date.now()-30*60*1000
  for(const [token,item] of previews) if(item.createdAt<expiry) previews.delete(token)
}

export function previewEpub(req: AuthRequest,res: Response){
  const files=(req.files as Express.Multer.File[]||[])
  if(!files.length) return error(res,'请选择 EPUB 文件','EPUB_REQUIRED',400)
  cleanup()
  try{
    const parsed=files.map(file=>({file,data:parseWithLegacy(file)}))
    const first=parsed[0].data
    const volumes=parsed.flatMap(({file,data})=>splitVolumes(
      chapterBodies(data.content,Array.isArray(data.chapters)?data.chapters:[]),
      file.originalname,data.title,files.length>1
    ))
    const token=crypto.randomBytes(18).toString('base64url')
    const preview: Preview={
      title:clean(first.title,200),author:clean(first.author,160),description:clean(first.excerpt,2000),
      cover:clean(first.cover_image,500),volumes,createdAt:Date.now(),
    }
    previews.set(token,preview)
    return success(res,{token,title:preview.title,author:preview.author,description:preview.description,cover:preview.cover,
      volumes:volumes.map((v,vi)=>({index:vi,title:v.title,source_filename:v.sourceFilename,chapter_count:v.chapters.length,
        chapters:v.chapters.map((c,ci)=>({index:ci,title:c.title}))}))},'EPUB 预览已生成，请确认结构后再导入')
  }catch(cause){
    return error(res,cause instanceof Error?cause.message:'EPUB 解析失败','EPUB_PREVIEW_FAILED',400)
  }
}

export function commitEpub(req: AuthRequest,res: Response){
  const preview=previews.get(clean(req.body?.token,200))
  if(!preview) return error(res,'预览已过期，请重新选择 EPUB','EPUB_PREVIEW_EXPIRED',410)
  const action=['append','overwrite','separate'].includes(req.body?.action)?req.body.action:'separate'
  const requestedBookId=Number(req.body?.book_id)||0
  const title=clean(req.body?.title||preview.title,200)
  if(!title) return error(res,'书名不能为空','VALIDATION_ERROR')
  const selections=Array.isArray(req.body?.volumes)?req.body.volumes:null
  const selectedVolumes=preview.volumes.map((volume,index)=>{
    const edit=selections?.find((item:any)=>Number(item?.index)===index)
    if(edit?.enabled===false) return null
    const selectedChapters=Array.isArray(edit?.chapters)?new Set(edit.chapters.map(Number)):null
    return {...volume,title:clean(edit?.title||volume.title,200),chapters:selectedChapters?volume.chapters.filter((_,i)=>selectedChapters.has(i)):volume.chapters}
  }).filter((volume): volume is Volume=>Boolean(volume&&volume.chapters.length))
  if(!selectedVolumes.length) return error(res,'至少选择一个包含章节的分卷','EMPTY_IMPORT',400)

  try{
    const result=db.transaction(()=>{
      let book:any=requestedBookId?db.prepare('SELECT * FROM books WHERE id=?').get(requestedBookId):null
      if(!book&&action!=='separate') book=db.prepare('SELECT * FROM books WHERE title=? AND deleted_at IS NULL ORDER BY id LIMIT 1').get(title)
      let savedAnnotations:any[]=[]
      if(book&&action==='overwrite'){
        savedAnnotations=db.prepare('SELECT a.*,c.title chapter_title FROM reader_annotations a LEFT JOIN book_chapters c ON c.id=a.chapter_id WHERE a.book_id=?').all(book.id) as any[]
        db.prepare('DELETE FROM reader_annotations WHERE book_id=?').run(book.id)
        db.prepare('DELETE FROM book_volumes WHERE book_id=?').run(book.id)
      }
      if(!book||action==='separate'){
        const slug=unique('books',req.body?.slug||title)
        const inserted=db.prepare('INSERT INTO books (title,slug,author,description,cover,status) VALUES (?,?,?,?,?,?)')
          .run(title,slug,clean(req.body?.author||preview.author,160),clean(req.body?.description||preview.description,4000),clean(req.body?.cover||preview.cover,500),'published')
        book=db.prepare('SELECT * FROM books WHERE id=?').get(inserted.lastInsertRowid)
      }else{
        db.prepare("UPDATE books SET title=?,author=?,description=?,cover=?,updated_at=datetime('now') WHERE id=?")
          .run(title,clean(req.body?.author||book.author||preview.author,160),clean(req.body?.description||book.description||preview.description,4000),clean(req.body?.cover||book.cover||preview.cover,500),book.id)
      }
      const chapterMap=new Map<string,{id:number;html:string;volumeId:number}>()
      const existingCount=(db.prepare('SELECT COUNT(*) count FROM book_volumes WHERE book_id=?').get(book.id) as any).count||0
      selectedVolumes.forEach((volume,volumeIndex)=>{
        const volumeSlug=unique('book_volumes',volume.title,book.id)
        const vr=db.prepare('INSERT INTO book_volumes (book_id,title,slug,sort_order,source_filename) VALUES (?,?,?,?,?)')
          .run(book.id,volume.title,volumeSlug,existingCount+volumeIndex,volume.sourceFilename)
        const volumeId=Number(vr.lastInsertRowid)
        volume.chapters.forEach((chapter,chapterIndex)=>{
          const chapterSlug=unique('book_chapters',chapter.title,volumeId)
          const cr=db.prepare('INSERT INTO book_chapters (volume_id,title,slug,content_html,sort_order,source_key) VALUES (?,?,?,?,?,?)')
            .run(volumeId,chapter.title,chapterSlug,chapter.html,chapterIndex,volume.sourceFilename+'#'+chapter.sourceIndex)
          chapterMap.set(chapter.title,{id:Number(cr.lastInsertRowid),html:chapter.html,volumeId})
        })
      })
      let recovered=0,pending=0
      for(const annotation of savedAnnotations){
        const target=chapterMap.get(annotation.chapter_title||'')
        const quote=String(annotation.quote||'').trim()
        const matched=target&&(!quote||target.html.includes(quote))
        db.prepare('INSERT INTO reader_annotations (user_id,book_id,volume_id,chapter_id,type,quote,prefix,suffix,note,color,position,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(annotation.user_id,book.id,matched?target.volumeId:null,matched?target.id:null,annotation.type,annotation.quote,annotation.prefix,annotation.suffix,
            annotation.note,annotation.color,annotation.position,matched?'active':'pending',annotation.created_at,new Date().toISOString())
        matched?recovered++:pending++
      }
      return {book_id:book.id,slug:book.slug,volume_count:selectedVolumes.length,chapter_count:selectedVolumes.reduce((sum,v)=>sum+v.chapters.length,0),annotations:{recovered,pending}}
    })()
    previews.delete(clean(req.body?.token,200))
    return success(res,result,'EPUB 已导入独立书库')
  }catch(cause){
    return error(res,cause instanceof Error?cause.message:'EPUB 导入失败','EPUB_COMMIT_FAILED',400)
  }
}