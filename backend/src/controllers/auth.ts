import { Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../config/database'
import { config } from '../config'
import { success, error } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

const AUTH_LIMITS = {
  username: 40,
  nickname: 60,
  avatar: 500,
  passwordMin: 8,
  passwordMax: 128,
}

function cleanText(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max)
}

export function login(req: AuthRequest, res: Response) {
  const { username, password } = req.body
  const safeUsername = cleanText(username, AUTH_LIMITS.username)
  const safePassword = String(password || '')
  if (!safeUsername || !safePassword) {
    return error(res, '请输入用户名和密码', 'VALIDATION_ERROR')
  }
  if (safePassword.length > AUTH_LIMITS.passwordMax) {
    return error(res, '用户名或密码错误', 'AUTH_ERROR', 401)
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(safeUsername) as any
  if (!user) {
    return error(res, '用户名或密码错误', 'AUTH_ERROR', 401)
  }

  const valid = bcrypt.compareSync(safePassword, user.password_hash)
  if (!valid) {
    return error(res, '用户名或密码错误', 'AUTH_ERROR', 401)
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as any }
  )

  return success(res, {
    token,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      role: user.role,
    },
  }, '登录成功')
}

export function me(req: AuthRequest, res: Response) {
  const user = db.prepare('SELECT id, username, nickname, avatar, role FROM users WHERE id = ?').get(req.userId!) as any
  if (!user) {
    return error(res, '用户不存在', 'NOT_FOUND', 404)
  }
  return success(res, user)
}

export function updateMe(req: AuthRequest, res: Response) {
  const { nickname, avatar, password } = req.body
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.userId!) as any
  if (!user) {
    return error(res, '用户不存在', 'NOT_FOUND', 404)
  }

  const safeNickname = nickname === undefined ? undefined : cleanText(nickname, AUTH_LIMITS.nickname)
  const safeAvatar = avatar === undefined ? undefined : cleanText(avatar, AUTH_LIMITS.avatar)
  const safePassword = password === undefined || password === '' ? '' : String(password)
  if (safePassword && safePassword.length < AUTH_LIMITS.passwordMin) {
    return error(res, `新密码不能少于 ${AUTH_LIMITS.passwordMin} 位`, 'WEAK_PASSWORD', 400)
  }
  if (safePassword.length > AUTH_LIMITS.passwordMax) {
    return error(res, `新密码不能超过 ${AUTH_LIMITS.passwordMax} 位`, 'PASSWORD_TOO_LONG', 400)
  }

  const passwordHash = safePassword ? bcrypt.hashSync(safePassword, 10) : undefined
  db.prepare(`
    UPDATE users
    SET nickname = COALESCE(?, nickname),
        avatar = COALESCE(?, avatar),
        password_hash = COALESCE(?, password_hash),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(safeNickname, safeAvatar, passwordHash, req.userId!)

  const updated = db.prepare('SELECT id, username, nickname, avatar, role FROM users WHERE id = ?').get(req.userId!)
  return success(res, updated, '个人信息已更新')
}
