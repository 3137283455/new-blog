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
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/bmp', 'image/svg+xml',
    'text/plain', 'text/markdown', 'text/csv', 'text/xml', 'application/json', 'application/xml',
    'application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/epub+zip',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/x-flac',
    'audio/mp4', 'audio/x-m4a', 'audio/webm',
    'font/woff', 'font/woff2', 'font/ttf', 'font/otf',
    'application/font-woff', 'application/font-woff2', 'application/x-font-ttf', 'application/x-font-otf',
    'application/vnd.ms-fontobject',
  ]
  const allowedExts = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.svg',
    '.txt', '.md', '.csv', '.json', '.xml', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.epub', '.zip', '.rar', '.7z',
    '.mp4', '.mov', '.mkv', '.avi', '.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.webm',
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

export const epubUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 80 * 1024 * 1024,
    files: 1,
  },
  fileFilter(_req, file, cb) {
    if (/\.epub$/i.test(file.originalname) || file.mimetype === 'application/epub+zip') {
      cb(null, true)
      return
    }
    cb(new Error('仅支持 .epub 文件'))
  },
})

export const mangaArchiveUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      const directory = path.join(config.uploadDir, '.manga-imports')
      fs.mkdirSync(directory, { recursive: true })
      cb(null, directory)
    },
    filename(_req, file, cb) {
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`)
    },
  }),
  limits: { fileSize: 300 * 1024 * 1024, files: 80 },
  fileFilter(_req, file, cb) {
    if (
      /\.(?:cbz|zip|cbr|rar|cb7|7z|cbt|tar|pdf|jpe?g|png|webp|gif|avif|bmp)$/i.test(file.originalname) ||
      ['application/zip','application/x-zip-compressed','application/x-rar-compressed','application/vnd.rar','application/x-7z-compressed','application/pdf','image/jpeg','image/png','image/webp','image/gif','image/avif','image/bmp'].includes(file.mimetype)
    ) {
      cb(null, true)
      return
    }
    cb(new Error('支持 CBZ/ZIP、PDF、图片文件；CBR/RAR、CB7/7Z、CBT/TAR 需独立解压服务'))
  },
})
export const textBookUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter(_req, file, cb) {
    if (/\.(?:txt|md|markdown)$/i.test(file.originalname) || ['text/plain', 'text/markdown'].includes(file.mimetype)) {
      cb(null, true)
      return
    }
    cb(new Error('仅支持 TXT 或 Markdown 文本书籍'))
  },
})