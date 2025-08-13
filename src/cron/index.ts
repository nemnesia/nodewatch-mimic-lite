import dotenv from 'dotenv'
import cron from 'node-cron'
import { getLogger } from '../utils/logger.js'
import { crawler } from './crawler.js'
const logger = getLogger('cron')

dotenv.config()

export const CRON_SCHEDULE = process.env.CRAWLER_CRON_SCHEDULE || '*/10 * * * *'

export const startJobs = () => {
  // 分(0-59) 時(0-23) 日(1-31) 月(1-12) 曜日(0-6: 0=日, 1=月, ..., 6=土)
  logger.info(`Starting crawler with schedule: ${CRON_SCHEDULE}`)
  cron.schedule(CRON_SCHEDULE, () => crawler())
}
