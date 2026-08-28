import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { error, success } from '../utils/response'
import {
  ContentSearchKind,
  contentSearchRuleErrors,
  getContentSearchConfig,
  normalizeContentSearchConfig,
  saveContentSearchConfig,
  testContentSearchSourceRule,
} from '../services/content-search-sources'

function clean(value: unknown, max = 200) { return String(value ?? '').trim().slice(0, max) }
function browserHeaders(req: AuthRequest) {
  const incoming = clean(req.get('user-agent'), 500)
  return {
    'User-Agent': /^Mozilla\/5\.0/i.test(incoming) ? incoming : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'X-Application-User-Agent': 'new-blog/1.0.0 (https://github.com/3137283455/new-blog)',
  }
}
function sourceFile(body: any) { return body?.file || body }
function validFile(file: any) { return file && file.schema === 'boke-content-search-source' && Number(file.version) === 1 && file.source }

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
  const file = sourceFile(req.body)
  if (!validFile(file)) return error(res, '不是有效的单源规则文件', 'INVALID_SEARCH_SOURCE_FILE', 400)
  const mode = clean(req.body?.file ? req.body?.mode : '', 20)
  const current = getContentSearchConfig()
  const originalId = clean(file.source?.id, 80).toLowerCase()
  const existing = current.sources.find((item) => item.id === originalId)
  if (existing && mode === 'skip') return success(res, current, `已跳过同名检索源 ${existing.label}`)
  if (existing && mode !== 'replace' && mode !== 'rename') return error(res, `检索源 ID“${originalId}”已存在，请选择覆盖、跳过或另存为`, 'SOURCE_CONFLICT', 409)
  const newId = mode === 'rename' ? clean(req.body?.new_id, 80).toLowerCase() : originalId
  const candidate = { ...file.source, id: newId }
  if (mode === 'rename' && current.sources.some((item) => item.id === newId)) return error(res, `检索源 ID“${newId}”也已存在`, 'SOURCE_CONFLICT', 409)
  const errors = contentSearchRuleErrors(candidate)
  if (errors.length) return error(res, errors.join('\n'), 'INVALID_SEARCH_SOURCE_RULE', 400)
  const sources = existing && mode === 'replace'
    ? current.sources.map((item) => item.id === originalId ? candidate : item)
    : [...current.sources, candidate]
  const normalized = normalizeContentSearchConfig({ version: 1, defaults: current.defaults, sources })
  if (!newId || !normalized.sources.some((item) => item.id === newId)) return error(res, '规则无法规范化，请检查字段格式', 'INVALID_SEARCH_SOURCE_RULE', 400)
  try {
    const config = saveContentSearchConfig(normalized)
    return success(res, config, existing && mode === 'replace' ? '检索源已覆盖' : '检索源已导入')
  } catch (cause) {
    return error(res, cause instanceof Error ? cause.message : '检索源导入失败', 'INVALID_SEARCH_SOURCE_RULE', 400)
  }
}
export async function testSource(req: AuthRequest, res: Response) {
  const file = sourceFile(req.body)
  if (!validFile(file)) return error(res, '不是有效的单源规则文件', 'INVALID_SEARCH_SOURCE_FILE', 400)
  const kind = clean(req.body?.kind, 20) as ContentSearchKind
  if (kind !== 'bangumi' && kind !== 'manga') return error(res, '请选择追番或漫画试跑类型', 'INVALID_SEARCH_KIND', 400)
  try {
    const result = await testContentSearchSourceRule(file.source, kind, clean(req.body?.query, 120), clean(req.body?.id, 80), browserHeaders(req))
    return success(res, result, '检索源试跑成功')
  } catch (cause) {
    return error(res, cause instanceof Error ? cause.message : '检索源试跑失败', 'SEARCH_SOURCE_TEST_FAILED', 400)
  }
}
export function removeSource(req: AuthRequest, res: Response) {
  const id = clean(req.params.id, 80).toLowerCase()
  const current = getContentSearchConfig()
  if (!current.sources.some((item) => item.id === id)) return error(res, '检索源不存在', 'NOT_FOUND', 404)
  try {
    const config = saveContentSearchConfig({ ...current, sources: current.sources.filter((item) => item.id !== id) })
    return success(res, config, '检索源已删除')
  } catch (cause) {
    return error(res, cause instanceof Error ? cause.message : '至少保留可用于追番和漫画的检索源', 'SOURCE_IN_USE', 400)
  }
}