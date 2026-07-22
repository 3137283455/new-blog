import { Response } from 'express'
import { success } from '../utils/response'
import { AuthRequest } from '../middleware/auth'
import { renderMarkdown } from '../utils/markdown'

export function preview(req: AuthRequest, res: Response) {
  const content = String(req.body?.content || '')
  return success(res, { html: renderMarkdown(content) }, '预览生成成功')
}
