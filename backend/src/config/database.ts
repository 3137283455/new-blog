import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { config } from './index'

const dbDir = path.dirname(config.dbPath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const db = new Database(config.dbPath)

// 启用 WAL 模式提升并发性能
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export default db
