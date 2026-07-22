import { Response } from 'express'

export function success(res: Response, data: any, message = '操作成功', pagination?: any) {
  const result: any = { success: true, data, message }
  if (pagination) result.pagination = pagination
  return res.json(result)
}

export function error(res: Response, message = '操作失败', code = 'ERROR', statusCode = 400) {
  return res.status(statusCode).json({ success: false, message, code })
}

export function paginationResult(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  }
}
