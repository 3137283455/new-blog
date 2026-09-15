import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { error, success } from '../utils/response'
import { logger, readLogs, logStats, cleanLogs } from '../utils/logger'
import db from '../config/database'

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
    memory: logger.checkMemory(false),
    logs: logStats(),
  })
}
export function policy(req: AuthRequest, res: Response) {
  const days = Number(req.body?.retention_days)
  if (!Number.isInteger(days) || days < 1 || days > 365) return error(res, '保留周期必须为 1 至 365 天', 'VALIDATION_ERROR')
  db.prepare("INSERT INTO settings(key,value) VALUES('logs_retention_days',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(days))
  return success(res, logStats(), '日志保留周期已保存')
}
export function clear(req: AuthRequest, res: Response) {
  const mode = req.body?.mode
  if (!['expired', 'all'].includes(mode)) return error(res, '请选择清理过期日志或全部日志', 'VALIDATION_ERROR')
  const result = cleanLogs(mode === 'all')
  logger.info('管理员清理日志', {source:'admin', mode, removed:result.removed})
  return success(res, result, '日志已清理，保留本次操作记录')
}
