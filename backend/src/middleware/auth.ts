import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { error } from '../utils/response'

export interface AuthRequest extends Request {
  userId?: number
  userRole?: string
}

export function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '未登录或 token 已过期', 'UNAUTHORIZED', 401)
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any
    req.userId = decoded.id
    req.userRole = decoded.role
    next()
  } catch (err) {
    return error(res, 'token 无效或已过期', 'UNAUTHORIZED', 401)
  }
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    return error(res, '无权限执行此操作', 'FORBIDDEN', 403)
  }
  next()
}
