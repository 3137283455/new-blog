import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { success } from '../utils/response'
import { rebuildSearchIndex, searchIndexStatus } from '../services/search-index'
import db from '../config/database'

export function adminSearch(req: AuthRequest, res: Response) {
  const term = String(req.query.q || '').trim().slice(0, 100)
  if (!term) return success(res, [])
  const q = '%' + term.replace(/[\\%_]/g, '\\$&') + '%'
  const articles = db.prepare("SELECT id,title FROM articles WHERE deleted_at IS NULL AND title LIKE ? ESCAPE '\\' LIMIT 12").all(q) as any[]
  const series = db.prepare("SELECT id,title FROM article_series WHERE title LIKE ? ESCAPE '\\' LIMIT 12").all(q) as any[]
  const media = db.prepare("SELECT id,original_name,path FROM media WHERE deleted_at IS NULL AND original_name LIKE ? ESCAPE '\\' LIMIT 12").all(q) as any[]
  return success(res, [
    ...articles.map(row => ({type:'文章',title:row.title,url:'/admin/write/editor?id='+row.id})),
    ...series.map(row => ({type:'专题',title:row.title,panel:'series'})),
    ...media.map(row => ({type:'媒体',title:row.original_name,url:'/uploads/'+row.path})),
  ])
}

export function status(_req: AuthRequest, res: Response) {
  return success(res, searchIndexStatus())
}

export function rebuild(_req: AuthRequest, res: Response) {
  rebuildSearchIndex()
  return success(res, searchIndexStatus(), '全站搜索索引已重建')
}
