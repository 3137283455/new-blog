import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { success } from '../utils/response'
import { rebuildSearchIndex, searchIndexStatus } from '../services/search-index'

export function status(_req: AuthRequest, res: Response) {
  return success(res, searchIndexStatus())
}

export function rebuild(_req: AuthRequest, res: Response) {
  rebuildSearchIndex()
  return success(res, searchIndexStatus(), '全站搜索索引已重建')
}
