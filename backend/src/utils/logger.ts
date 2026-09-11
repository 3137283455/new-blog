import fs from 'node:fs'
import path from 'node:path'
import db from '../config/database'

const logDir = path.resolve(__dirname, '../../logs')
const logPath = path.join(logDir, 'application.jsonl')
const maxFileBytes = 10 * 1024 * 1024
const maxFiles = 10
let memoryOverThresholdCount = 0
let memoryAlertActive = false

type LogLevel = 'info' | 'warn' | 'error'
export type LogContext = Record<string, unknown>
export type LogEntry = {
  id: string
  timestamp: string
  level: LogLevel
  source: string
  message: string
  context?: LogContext
  stack?: string
}

if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })

function redact(value: unknown, key = ''): unknown {
  if (/authorization|cookie|password|passwd|token|secret|jwt|api[-_]?key/i.test(key)) return '[REDACTED]'
  if (value instanceof Error) return value.message
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => redact(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 50).map(([name, item]) => [name, redact(item, name)]))
  }
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
      .replace(/([?&](?:token|key|secret|password|authorization)=)[^&]*/gi, '$1[REDACTED]')
      .slice(0, 10000)
  }
  return value
}

function rotateIfNeeded() {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size < maxFileBytes) return
    for (let index = maxFiles - 1; index >= 1; index -= 1) {
      const current = path.join(logDir, `application.${index}.jsonl`)
      const next = path.join(logDir, `application.${index + 1}.jsonl`)
      if (fs.existsSync(next)) fs.rmSync(next, { force: true })
      if (fs.existsSync(current)) fs.renameSync(current, next)
    }
    fs.renameSync(logPath, path.join(logDir, 'application.1.jsonl'))
  } catch (cause) {
    console.error('日志轮转失败', cause)
  }
}

function errorParts(cause: unknown) {
  if (!cause) return {}
  if (cause instanceof Error) return { error: cause.message, stack: cause.stack }
  return { error: String(cause) }
}

function numberSetting(key: string, fallback: number) {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value?: string } | undefined
    const value = Number(row?.value)
    return Number.isFinite(value) && value > 0 ? value : fallback
  } catch {
    return fallback
  }
}

function write(level: LogLevel, message: string, context: LogContext = {}, cause?: unknown) {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    level,
    source: String(context.source || 'backend'),
    message: String(message || '').slice(0, 1000),
    context: redact(context) as LogContext,
    ...redact(errorParts(cause)) as Record<string, string | undefined>,
  }
  rotateIfNeeded()
  fs.appendFile(logPath, `${JSON.stringify(entry)}\n`, (err) => {
    if (err) console.error('写入日志失败:', err)
  })
  const consoleMessage = `[${level.toUpperCase()}] ${entry.message}`
  if (level === 'error') console.error(consoleMessage, cause || '')
  else if (level === 'warn') console.warn(consoleMessage)
  else console.log(consoleMessage)
}

function logFiles() {
  return [logPath, ...Array.from({ length: maxFiles }, (_, index) => path.join(logDir, `application.${index + 1}.jsonl`))]
    .filter((file) => fs.existsSync(file))
}

export function readLogs(options: { level?: string; source?: string; query?: string; limit?: number } = {}) {
  const level = options.level || ''
  const source = options.source || ''
  const query = (options.query || '').toLocaleLowerCase()
  const limit = Math.max(1, Math.min(10000, options.limit || 50))
  const entries: LogEntry[] = []
  for (const file of logFiles()) {
    let lines: string[] = []
    try { lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean) } catch { continue }
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as LogEntry
        if (level && entry.level !== level) continue
        if (source && entry.source !== source) continue
        if (query && !JSON.stringify(entry).toLocaleLowerCase().includes(query)) continue
        entries.push(entry)
      } catch { /* ignore a partially written or legacy line */ }
    }
  }
  entries.sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)))
  return { items: entries.slice(0, limit), total: entries.length, sources: Array.from(new Set(entries.map((item) => item.source))).sort() }
}

export function logStats() {
  const now = Date.now()
  const entries = readLogs({ limit: 10000 }).items
  return {
    total: entries.length,
    errors_24h: entries.filter((item) => item.level === 'error' && now - Date.parse(item.timestamp) <= 86400000).length,
    warnings_24h: entries.filter((item) => item.level === 'warn' && now - Date.parse(item.timestamp) <= 86400000).length,
    latest_at: entries[0]?.timestamp || '',
  }
}

export const logger = {
  info(message: string, context: LogContext = {}) { write('info', message, context) },
  warn(message: string, context: LogContext = {}, cause?: unknown) { write('warn', message, context, cause) },
  error(message: string, cause?: unknown, context: LogContext = {}) { write('error', message, context, cause) },
  request(req: { method: string; path: string; requestId?: string }, status: number, durationMs: number) {
    if (status < 400) return
    write(status >= 500 ? 'error' : 'warn', `HTTP ${status} ${req.method} ${req.path}`, {
      source: 'http', request_id: req.requestId || '', method: req.method, path: req.path,
      status, duration_ms: Math.round(durationMs),
    })
  },
  checkMemory() {
    const used = process.memoryUsage()
    const rssMB = Math.round((used.rss / 1024 / 1024) * 100) / 100
    const heapMB = Math.round((used.heapUsed / 1024 / 1024) * 100) / 100
    const warnMB = numberSetting('memory_warn_mb', 512)
    const criticalMB = Math.max(warnMB + 1, numberSetting('memory_critical_mb', 768))
    if (rssMB >= warnMB) {
      memoryOverThresholdCount += 1
      if (memoryOverThresholdCount >= 3 && !memoryAlertActive) {
        memoryAlertActive = true
        this.warn(`内存占用过高: RSS=${rssMB}MB, Heap=${heapMB}MB`, {
          source: 'system', rss_mb: rssMB, heap_mb: heapMB, warn_mb: warnMB,
          critical_mb: criticalMB, consecutive_checks: memoryOverThresholdCount,
        })
      }
    } else {
      if (memoryAlertActive) this.info(`内存占用已恢复: RSS=${rssMB}MB`, { source: 'system', rss_mb: rssMB, warn_mb: warnMB })
      memoryOverThresholdCount = 0
      memoryAlertActive = false
    }
    return { rss: rssMB, heap: heapMB }
  },
}

setInterval(() => logger.checkMemory(), 60000)
