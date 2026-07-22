import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.BACKEND_HOST || '127.0.0.1',
  jwtSecret: process.env.JWT_SECRET || 'boke-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../data/blog.db'),
  uploadDir: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads'),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  maxFontFileSize: parseInt(process.env.MAX_FONT_FILE_SIZE || '104857600', 10), // 100MB
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',
}
