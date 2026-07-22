import fs from 'fs'
import path from 'path'

const logDir = path.resolve(__dirname, '../../logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const errorLogPath = path.join(logDir, 'error.log')
const accessLogPath = path.join(logDir, 'access.log')

function timestamp(): string {
  return new Date().toISOString()
}

function writeLog(filePath: string, message: string) {
  const line = `[${timestamp()}] ${message}\n`
  fs.appendFile(filePath, line, (err) => {
    if (err) console.error('写入日志失败:', err)
  })
}

export const logger = {
  info(message: string) {
    console.log(`[INFO] ${message}`)
    writeLog(accessLogPath, `[INFO] ${message}`)
  },

  error(message: string, error?: any) {
    const detail = error ? `: ${error.stack || error.message || error}` : ''
    console.error(`[ERROR] ${message}${detail}`)
    writeLog(errorLogPath, `[ERROR] ${message}${detail}`)
  },

  warn(message: string) {
    console.warn(`[WARN] ${message}`)
    writeLog(accessLogPath, `[WARN] ${message}`)
  },

  // 资源占用告警
  checkMemory() {
    const used = process.memoryUsage()
    const rssMB = Math.round((used.rss / 1024 / 1024) * 100) / 100
    const heapMB = Math.round((used.heapUsed / 1024 / 1024) * 100) / 100
    if (rssMB > 250) {
      this.warn(`内存占用过高: RSS=${rssMB}MB, Heap=${heapMB}MB`)
    }
    return { rss: rssMB, heap: heapMB }
  },
}

// 每分钟检查一次内存
setInterval(() => logger.checkMemory(), 60000)
