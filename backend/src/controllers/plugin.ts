import { Response } from 'express'
import db from '../config/database'
import { success, error } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

const BUILTIN_PLUGIN_IDS = [
  'reading-progress',
  'table-of-contents',
  'word-count',
  'back-to-top',
  'article-like',
  'reading-history',
  'article-bookmark',
  'reading-mode',
  'code-copy',
] as const
const BUILTIN_PLUGIN_SET = new Set<string>(BUILTIN_PLUGIN_IDS)
const builtinPlaceholders = BUILTIN_PLUGIN_IDS.map(() => '?').join(',')

// ===== 公开：获取已启用的插件列表 =====
export function activePlugins(_req: AuthRequest, res: Response) {
  const plugins = db.prepare(`SELECT id, name FROM plugins WHERE is_active = 1 AND id IN (${builtinPlaceholders})`).all(...BUILTIN_PLUGIN_IDS)
  return success(res, plugins)
}

// ===== 管理 =====
export function list(_req: AuthRequest, res: Response) {
  const plugins = db.prepare(`SELECT * FROM plugins WHERE id IN (${builtinPlaceholders}) ORDER BY is_active DESC, name ASC`).all(...BUILTIN_PLUGIN_IDS)
  const result = plugins.map((p: any) => ({ ...p, is_active: !!p.is_active }))
  return success(res, result)
}

export function toggle(req: AuthRequest, res: Response) {
  const id = String(req.params.id)
  if (!BUILTIN_PLUGIN_SET.has(id)) return error(res, '该功能尚未接入前台', 'UNSUPPORTED_PLUGIN', 400)
  const plugin = db.prepare('SELECT * FROM plugins WHERE id = ?').get(id) as any
  if (!plugin) return error(res, '插件不存在', 'NOT_FOUND', 404)
  const newState = plugin.is_active ? 0 : 1
  db.prepare('UPDATE plugins SET is_active = ? WHERE id = ?').run(newState, id)
  const msg = newState ? '插件已启用' : '插件已禁用'
  return success(res, null, msg)
}
