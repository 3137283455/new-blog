import { Response } from 'express'
import db from '../config/database'
import { success, error } from '../utils/response'
import { AuthRequest } from '../middleware/auth'

const THEME_LIMITS = {
  id: 60,
  name: 60,
  author: 60,
  description: 240,
}

function cleanText(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max)
}

function isSafeId(value: string) {
  return /^[a-z0-9][a-z0-9_-]{1,59}$/i.test(value)
}

function isColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value)
}

function parseConfig(config: unknown) {
  if (!config || typeof config !== 'string') return {}
  try {
    return JSON.parse(config)
  } catch {
    return {}
  }
}

// ===== 公开：获取当前激活主题（支持预览 cookie） =====
export function active(req: AuthRequest, res: Response) {
  const previewId = req.cookies?.theme_preview
  let theme: any = null
  if (previewId) {
    theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(previewId) as any
  }
  if (!theme) {
    theme = db.prepare('SELECT * FROM themes WHERE is_active = 1').get() as any
  }
  theme.config = parseConfig(theme?.config)
  return success(res, { ...(theme || {}), isPreview: !!previewId })
}

// ===== 管理 =====
export function list(_req: AuthRequest, res: Response) {
  const themes = db.prepare('SELECT * FROM themes ORDER BY is_active DESC, name ASC').all()
  // 解析 config
  const result = themes.map((t: any) => ({
    ...t,
    is_active: !!t.is_active,
    config: parseConfig(t.config),
  }))
  return success(res, result)
}

export function install(req: AuthRequest, res: Response) {
  const { id, name, primary, primary_hover, primary_light, author, description } = req.body
  const safeId = cleanText(id, THEME_LIMITS.id)
  const safeName = cleanText(name, THEME_LIMITS.name)
  const safePrimary = cleanText(primary, 7)
  const safeHover = cleanText(primary_hover || primary, 7)
  const safeLight = cleanText(primary_light || '#dbeafe', 7)
  if (!safeId || !safeName || !safePrimary) {
    return error(res, '主题 ID、名称和主色调为必填项')
  }
  if (!isSafeId(safeId)) return error(res, '主题 ID 只能使用字母、数字、下划线或短横线', 'INVALID_THEME_ID', 400)
  if (!isColor(safePrimary) || !isColor(safeHover) || !isColor(safeLight)) return error(res, '主题颜色必须是 #RRGGBB 格式', 'INVALID_THEME_COLOR', 400)

  // 检查是否已存在
  const existing = db.prepare('SELECT id FROM themes WHERE id = ?').get(safeId)
  if (existing) {
    return error(res, '该主题 ID 已存在', 'DUPLICATE_ERROR', 409)
  }

  const config = JSON.stringify({
    primary: safePrimary,
    primary_hover: safeHover,
    primary_light: safeLight,
  })

  db.prepare(`INSERT INTO themes (id, name, version, author, description, screenshot, is_active, config)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)`).run(
    safeId,
    safeName,
    '1.0.0',
    cleanText(author || '自定义', THEME_LIMITS.author),
    cleanText(description || `${safeName}主题`, THEME_LIMITS.description),
    '',
    config
  )

  return success(res, null, '主题安装成功')
}

export function activate(req: AuthRequest, res: Response) {
  const { id } = req.params
  const theme = db.prepare('SELECT id FROM themes WHERE id = ?').get(id)
  if (!theme) return error(res, '主题不存在', 'NOT_FOUND', 404)

  // 取消所有激活
  db.prepare('UPDATE themes SET is_active = 0').run()
  // 激活目标主题
  db.prepare('UPDATE themes SET is_active = 1 WHERE id = ?').run(id)
  // 同步到设置表
  db.prepare("INSERT OR REPLACE INTO settings (key, value, type, description) VALUES ('active_theme', ?, 'string', '当前激活主题')").run(id)

  return success(res, null, '主题已切换')
}

// 预览主题（设置临时 cookie，不保存到数据库）
export function preview(req: AuthRequest, res: Response) {
  const { id } = req.params
  const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(id) as any
  if (!theme) return error(res, '主题不存在', 'NOT_FOUND', 404)
  theme.config = parseConfig(theme.config)
  res.cookie('theme_preview', id, { maxAge: 3600000, httpOnly: false })
  return success(res, theme, '主题预览中')
}

// 清除预览
export function clearPreview(_req: AuthRequest, res: Response) {
  res.clearCookie('theme_preview')
  return success(res, null, '已退出预览')
}

export function remove(req: AuthRequest, res: Response) {
  const { id } = req.params
  const theme = db.prepare('SELECT is_active FROM themes WHERE id = ?').get(id) as any
  if (!theme) return error(res, '主题不存在', 'NOT_FOUND', 404)
  if (theme.is_active) return error(res, '不能删除当前激活的主题')

  db.prepare('DELETE FROM themes WHERE id = ?').run(id)
  return success(res, null, '主题已删除')
}
