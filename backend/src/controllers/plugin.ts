import { Response } from 'express'
import db from '../config/database'
import { success, error } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

const PLUGIN_LIMITS = {
  id: 60,
  name: 60,
  description: 240,
}

function cleanText(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max)
}

function isSafeId(value: string) {
  return /^[a-z0-9][a-z0-9_-]{1,59}$/i.test(value)
}

// ===== 公开：获取已启用的插件列表 =====
export function activePlugins(_req: AuthRequest, res: Response) {
  const plugins = db.prepare('SELECT id, name FROM plugins WHERE is_active = 1').all()
  return success(res, plugins)
}

// ===== 管理 =====
export function list(_req: AuthRequest, res: Response) {
  const plugins = db.prepare('SELECT * FROM plugins ORDER BY is_active DESC, name ASC').all()
  const result = plugins.map((p: any) => ({ ...p, is_active: !!p.is_active }))
  return success(res, result)
}

export function toggle(req: AuthRequest, res: Response) {
  const { id } = req.params
  const plugin = db.prepare('SELECT * FROM plugins WHERE id = ?').get(id) as any
  if (!plugin) return error(res, '插件不存在', 'NOT_FOUND', 404)
  const newState = plugin.is_active ? 0 : 1
  db.prepare('UPDATE plugins SET is_active = ? WHERE id = ?').run(newState, id)
  const msg = newState ? '插件已启用' : '插件已禁用'
  return success(res, null, msg)
}

export function install(req: AuthRequest, res: Response) {
  const { id, name, description } = req.body
  const safeId = cleanText(id, PLUGIN_LIMITS.id)
  const safeName = cleanText(name, PLUGIN_LIMITS.name)
  if (!safeId || !safeName) return error(res, '插件 ID 和名称为必填项')
  if (!isSafeId(safeId)) return error(res, '插件 ID 只能使用字母、数字、下划线或短横线', 'INVALID_PLUGIN_ID', 400)

  const existing = db.prepare('SELECT id FROM plugins WHERE id = ?').get(safeId)
  if (existing) return error(res, '该插件 ID 已存在', 'DUPLICATE_ERROR', 409)

  db.prepare(`INSERT INTO plugins (id, name, version, author, description, is_active, config)
    VALUES (?, ?, '1.0.0', ?, ?, 0, '{}')`).run(
    safeId,
    safeName,
    '自定义',
    cleanText(description || `${safeName}插件`, PLUGIN_LIMITS.description)
  )

  return success(res, null, '插件安装成功')
}
