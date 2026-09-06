import type { Response } from 'express'
import db from '../../../config/database'
import type { DeviceRequest } from '../../../middleware/device'
import { success, error } from '../../../utils/response'
import { ReadingProgressRepository } from './reading-progress'

const repository = new ReadingProgressRepository(db)
const id = (value: unknown) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0
export function getReadingState(req: DeviceRequest, res: Response) { return success(res, repository.get(req.deviceUserId!, id(req.params.mangaId))) }
export function privateLibrary(req: DeviceRequest, res: Response) { return success(res, repository.library(req.deviceUserId!)) }
export function putReadingState(req: DeviceRequest, res: Response) {
  const result = repository.save(req.deviceUserId!, req.deviceId!, id(req.params.mangaId), req.body || {})
  if (result.status === 'missing') return error(res, '本地漫画不存在', 'NOT_FOUND', 404)
  if (result.status === 'invalid-chapter') return error(res, '章节不属于当前漫画或分卷', 'INVALID_MANGA_CHAPTER', 400)
  if (result.status === 'conflict') return res.status(409).json({ success: false, code: 'READING_CONFLICT', message: '另一台设备已有更新，请选择保留哪一份进度', data: { server: result.server, submitted: req.body } })
  if (result.status === 'saved') return success(res, { revision: result.revision }, '漫画进度已同步')
}
