import dotenv from 'dotenv'
import app from './express.js'
import { getLogger } from './utils/logger.js'
const logger = getLogger('web')

dotenv.config()

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  logger.info(`Server running`)
  logger.info(`- http://localhost:${PORT}/api/symbol/height`)
  logger.info(`- http://localhost:${PORT}/api/symbol/nodes/peer`)
  logger.info(`- http://localhost:${PORT}/api/symbol/nodes/api`)
})
