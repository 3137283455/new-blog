import { Request, Response, NextFunction } from 'express'
import db from '../config/database'

// 简单的访客日志中间件
export default function visitorLogger(req: Request, _res: Response, next: NextFunction) {
  // 跳过静态资源和 API 健康检查
  if (req.path.startsWith('/uploads') || req.path === '/api/health') {
    return next()
  }

  // 异步记录，不阻塞请求
  try {
    const stmt = db.prepare(
      'INSERT INTO visitor_logs (ip, user_agent, path, referer) VALUES (?, ?, ?, ?)'
    )
    stmt.run(
      req.ip || req.socket.remoteAddress || '',
      req.headers['user-agent'] || '',
      req.path,
      req.headers.referer || ''
    )
  } catch {
    // 静默失败，不影响主请求
  }

  next()
}
