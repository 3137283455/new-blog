import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { config } from './config'
import { migrate } from './database/schema'
import { seed } from './database/seed'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'
import routes from './routes'
import visitorLogger from './middleware/visitor'

const app = express()

const allowedOrigins = new Set([
  ...config.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean),
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true,
  }),
)
app.use(cookieParser())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use(visitorLogger)

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
    },
    message: '服务正常',
  })
})

app.use('/uploads', express.static(config.uploadDir))
app.use('/api', routes)

app.use(notFoundHandler)
app.use(errorHandler)

migrate()
seed()

app.listen(config.port, config.host, () => {
  logger.info(`博客后端已启动: http://localhost:${config.port}`)
  logger.info(`运行环境: ${config.nodeEnv}`)
})

process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常', err)
})

process.on('unhandledRejection', (reason) => {
  logger.error('未处理的 Promise 拒绝', reason)
})

export default app
