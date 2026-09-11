import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { error, success } from '../utils/response'
import { logger, readLogs, logStats } from '../utils/logger'

export function list(req: AuthRequest, res: Response) {
  const level = String(req.query.level || '').trim().toLowerCase()
  const source = String(req.query.source || '').trim().slice(0, 40)
  const query = String(req.query.q || '').trim().slice(0, 100)
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50))
  if (level && !['error', 'warn', 'info'].includes(level)) return error(res, '日志级别无效', 'VALIDATION_ERROR')
  return success(res, readLogs({ level, source, query, limit }))
}

export function stats(_req: AuthRequest, res: Response) {
  return success(res, logStats())
}

export function diagnostics(_req: AuthRequest, res: Response) {
  logger.info('管理员请求诊断信息', { source: 'admin' })
  return success(res, {
    generated_at: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    memory: logger.checkMemory(),
    logs: logStats(),
  })
}
