import dotenv from 'dotenv'
import { crawler } from './cron/crawler.js'

dotenv.config()

crawler()
