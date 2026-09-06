import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { getVeneraRepositoryConfig, importVeneraRepository, removeVeneraRepository, searchVeneraSource, exportVeneraConfiguration, importVeneraConfiguration, setVeneraSourceEnabled, getVeneraSourceSettings, saveVeneraSourceSettings } from '../services/venera-sources'
import { error, success } from '../utils/response'

function clean(value: unknown, max = 500) { return String(value ?? '').trim().slice(0, max) }

function present(config: ReturnType<typeof getVeneraRepositoryConfig>) {
  const records = config.repositories.flatMap((repository) => repository.sources)
  const sources = records.map((source) => ({ ...source, label: source.name }))
  return {
    ...config,
    repositories: config.repositories.map((repository) => ({ ...repository, source_count: repository.sources.length })),
    sources,
    total: records.length,
  }
}

export function list(_req: AuthRequest, res: Response) {
  return success(res, present(getVeneraRepositoryConfig()))
}

export async function importRepository(req: AuthRequest, res: Response) {
  try {
    const config = req.body?.file ? importVeneraConfiguration(req.body.file, req.body.mode || 'merge') : await importVeneraRepository(req.body?.url)
    return success(res, present(config), 'Venera 漫画源仓库已同步')
  } catch (cause) {
    return error(res, cause instanceof Error ? cause.message : 'Venera 漫画源仓库导入失败', 'VENERA_REPOSITORY_IMPORT_FAILED', 400)
  }
}

export function exportConfiguration(_req: AuthRequest, res: Response) {
  res.setHeader('Content-Disposition', 'attachment; filename="venera-repositories.json"')
  res.setHeader('Cache-Control', 'no-store')
  return res.json(exportVeneraConfiguration())
}

export function toggleSource(req: AuthRequest, res: Response) {
  try { return success(res, present(setVeneraSourceEnabled(req.params.sourceId, req.body?.enabled))) }
  catch (cause) { return error(res, cause instanceof Error ? cause.message : '源状态保存失败', 'VENERA_SOURCE_UPDATE_FAILED', 400) }
}

export async function sourceSettings(req: AuthRequest, res: Response) {
  try {
    if (req.method === 'PUT') await saveVeneraSourceSettings(req.params.sourceId, req.body?.values)
    return success(res, await getVeneraSourceSettings(req.params.sourceId))
  } catch (cause) { return error(res, cause instanceof Error ? cause.message : '源设置读取失败', 'VENERA_SOURCE_SETTINGS_FAILED', 400) }
}

export function removeRepository(req: AuthRequest, res: Response) {
  const config = removeVeneraRepository(req.body?.url || req.query.url)
  return success(res, present(config), 'Venera 漫画源仓库已移除')
}

export async function testSource(req: AuthRequest, res: Response) {
  const source = clean(req.body?.source, 180), query = clean(req.body?.query || 'test', 120)
  if (!source) return error(res, '请选择 Venera 漫画源', 'VENERA_SOURCE_REQUIRED', 400)
  try {
    const startedAt = Date.now()
    const result = await searchVeneraSource(source, query, 1)
    return success(res, { source: { id: result.record.id, name: result.record.name, version: result.record.version }, items: result.items.slice(0, 8), latency_ms: Date.now() - startedAt }, `源试跑完成，共返回 ${result.items.length} 条`)
  } catch (cause) {
    return error(res, cause instanceof Error ? cause.message : 'Venera 漫画源试跑失败', 'VENERA_SOURCE_TEST_FAILED', 400)
  }
}
