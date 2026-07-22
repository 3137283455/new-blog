import { Request, Response, NextFunction } from 'express'
import { error } from '../utils/response'
import { logger } from '../utils/logger'

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  logger.error(err.message || '请求处理错误', err)

  if (err.code === 'LIMIT_FILE_SIZE') {
    return error(res, '文件过大，请检查后台配置的上传大小限制', 'FILE_TOO_LARGE', 413)
  }

  if (err.name === 'ValidationError') {
    return error(res, err.message, 'VALIDATION_ERROR', 422)
  }

  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return error(res, '数据已存在', 'DUPLICATE_ERROR', 409)
  }

  return error(res, err.message || '服务器内部错误', 'INTERNAL_ERROR', 500)
}

export function notFoundHandler(_req: Request, res: Response) {
  return error(res, '接口不存在', 'NOT_FOUND', 404)
}
