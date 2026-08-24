import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import db from '../config/database'
import { error } from '../utils/response'

export interface DeviceRequest extends Request {
  deviceId?: number
  deviceUserId?: number
}

export function hashDeviceToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function deviceAuth(req: DeviceRequest, res: Response, next: NextFunction) {
  const raw = String(req.headers['x-device-token'] || '').trim()
  if (!raw) return error(res, '此功能仅限已验证的私人设备', 'DEVICE_REQUIRED', 401)
  const row = db.prepare(
    'SELECT id, user_id FROM private_devices WHERE token_hash = ? AND revoked_at IS NULL'
  ).get(hashDeviceToken(raw)) as { id: number; user_id: number } | undefined
  if (!row) return error(res, '私人设备凭证无效或已被撤销', 'DEVICE_INVALID', 401)
  req.deviceId = row.id
  req.deviceUserId = row.user_id
  db.prepare("UPDATE private_devices SET last_seen_at = datetime('now') WHERE id = ?").run(row.id)
  next()
}