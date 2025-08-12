import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

// 環境変数を確実に読み込む
dotenv.config()

const logDir = process.env.LOG_DIR || 'logs'
const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS || '14', 10)
const level = process.env.LOG_LEVEL || 'info'
const fileLevel = process.env.LOG_FILE_LEVEL || level
const consoleLevel = process.env.LOG_CONSOLE_LEVEL || level

// ログディレクトリが存在しない場合は作成
const logDirPath = path.resolve(process.cwd(), logDir)
if (!fs.existsSync(logDirPath)) {
  fs.mkdirSync(logDirPath, { recursive: true })
}

// 用途ごとにloggerインスタンスをキャッシュ
const loggerCache: Record<string, winston.Logger> = {}

function getLogger(category: 'web' | 'cron' | string = 'app'): winston.Logger {
  if (loggerCache[category]) return loggerCache[category]

  // ファイル名を用途ごとに分ける
  const filePrefix = category === 'web' ? 'web' : category === 'cron' ? 'cron' : 'app'
  const transport = new DailyRotateFile({
    dirname: logDirPath,
    filename: `${filePrefix}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: `${retentionDays}d`,
    auditFile: path.join(logDirPath, `${filePrefix}-audit.json`),
    createSymlink: true,
    symlinkName: `${filePrefix}-current.log`,
    level: fileLevel,
  })

  const logger = winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY/MM/DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const paddedLevel = level.toUpperCase().padEnd(5, ' ')
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
        return `${timestamp} [${paddedLevel}] ${message}${metaStr}`
      }),
    ),
    transports: [
      transport,
      new winston.transports.Console({
        level: consoleLevel,
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY/MM/DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const paddedLevel = level.toUpperCase().padEnd(5, ' ')
            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
            return `${timestamp} [${paddedLevel}] ${message}${metaStr}`
          }),
          winston.format.colorize({ all: true }),
        ),
      }),
    ],
  })

  // 起動時にログディレクトリとファイルの情報を出力
  logger.info(`Log directory: ${logDirPath}`)
  logger.info(`Log retention: ${retentionDays} days`)
  logger.info(`Log level: ${level}`)
  logger.info(`File log level: ${fileLevel}`)
  logger.info(`Console log level: ${consoleLevel}`)
  logger.info(`Logger category: ${category}`)

  loggerCache[category] = logger
  return logger
}

export { getLogger }
