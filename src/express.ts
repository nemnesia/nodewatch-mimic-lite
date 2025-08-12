import express from 'express'
import routes from './routes/index.js'
import { getLogger } from './utils/logger.js'

const logger = getLogger('web')

const app = express()
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`)
  next()
})
app.use(express.json())
app.use('/', routes)

export default app
