import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { config } from '../config'
import { Request } from 'express'

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true })
}

const getDateDir = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}/${month}`
}

const storage = multer.diskStorage({
  destination(_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    const dir = path.join(config.uploadDir, getDateDir())
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    cb(null, dir)
  },
  filename(_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, uniqueSuffix + ext)
  },
})

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase()
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/zip',
    'video/mp4',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/x-flac',
    'audio/mp4', 'audio/x-m4a', 'audio/webm',
    'font/woff', 'font/woff2', 'font/ttf', 'font/otf',
    'application/font-woff', 'application/font-woff2', 'application/x-font-ttf', 'application/x-font-otf',
    'application/vnd.ms-fontobject',
  ]
  const allowedExts = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    '.pdf', '.zip',
    '.mp4', '.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.webm',
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
  ]

  if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true)
    return
  }

  cb(new Error('不支持的文件类型'))
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Math.max(config.maxFileSize, config.maxFontFileSize),
  },
})

export const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 256 * 1024 * 1024,
  },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.db', '.sqlite', '.sqlite3', '.json'].includes(ext)) {
      cb(null, true)
      return
    }
    cb(new Error('仅支持 .db、.sqlite、.sqlite3 和 .json 备份文件'))
  },
})
