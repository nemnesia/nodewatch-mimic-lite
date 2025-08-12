import dotenv from 'dotenv'
import { startJobs } from './cron/index.js'

dotenv.config()

startJobs()
