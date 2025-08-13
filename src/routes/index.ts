import { Router } from 'express'
import symbolRouter from '../controllers/symbolController.js'
import { getLogger } from '../utils/logger.js'
const logger = getLogger('web')

const router = Router()

router.use('/api/symbol', symbolRouter)

// 404ハンドラー
router.use(/.*/, (req, res) => {
  const isDevToolsRequest =
    req.originalUrl.includes('/.well-known/') ||
    req.originalUrl.includes('/favicon.ico') ||
    req.originalUrl.includes('/chrome-extension/')

  if (isDevToolsRequest) {
    logger.debug(`404 - ${req.method} ${req.originalUrl}`)
  } else {
    logger.warn(`404 - ${req.method} ${req.originalUrl}`)
  }

  res.status(404).json({ error: 'Endpoint not found' })
})

export default router
