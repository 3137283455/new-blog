import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { error, success } from '../utils/response'
import { getContentSearchConfig, normalizeContentSearchConfig, saveContentSearchConfig } from '../services/content-search-sources'

export function getConfig(_req: AuthRequest, res: Response) {
  return success(res, getContentSearchConfig())
}
export function saveConfig(req: AuthRequest, res: Response) {
  try {
    const config = saveContentSearchConfig(req.body)
    return success(res, config, '检索源设置已保存')
  } catch (cause) {
    return error(res, cause instanceof Error ? cause.message : '检索源设置无效', 'INVALID_SEARCH_SOURCE_CONFIG', 400)
  }
}
export function importSource(req: AuthRequest, res: Response) {
  const file = req.body
  if (!file || file.schema !== 'boke-content-search-source' || Number(file.version) !== 1 || !file.source) {
    return error(res, '不是有效的单源规则文件', 'INVALID_SEARCH_SOURCE_FILE', 400)
  }
  const current = getContentSearchConfig()
  const id = String(file.source?.id || '').trim().toLowerCase()
  const sources = [...current.sources.filter((item) => item.id !== id), file.source]
  const normalized = normalizeContentSearchConfig({ version: 1, defaults: current.defaults, sources })
  if (!id || !normalized.sources.some((item) => item.id === id)) {
    return error(res, '源规则缺少必要字段，请检查 API、路径、类型和字段映射', 'INVALID_SEARCH_SOURCE_RULE', 400)
  }
  try {
    const config = saveContentSearchConfig(normalized)
    return success(res, config, '检索源已导入')
  } catch (cause) {
    return error(res, cause instanceof Error ? cause.message : '检索源导入失败', 'INVALID_SEARCH_SOURCE_RULE', 400)
  }
}
export function removeSource(req: AuthRequest, res: Response) {
  const id = String(req.params.id || '').trim().toLowerCase()
  const current = getContentSearchConfig()
  if (!current.sources.some((item) => item.id === id)) return error(res, '检索源不存在', 'NOT_FOUND', 404)
  try {
    const config = saveContentSearchConfig({ ...current, sources: current.sources.filter((item) => item.id !== id) })
    return success(res, config, '检索源已删除')
  } catch (cause) {
    return error(res, cause instanceof Error ? cause.message : '至少保留可用于追番和漫画的检索源', 'SOURCE_IN_USE', 400)
  }
}