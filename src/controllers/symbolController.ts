import { Router } from 'express'
import { handleHeight } from '../services/height.js'
import { handleNodesApi } from '../services/nodesApi.js'
import { handleNodesPeer } from '../services/nodesPeer.js'
import { handleNodesPeersP2p } from '../services/nodesPeerP2p.js'

const router = Router()

router.get('/height', async (req, res) => {
  return handleHeight(req, res)
})

router.get('/nodes/peer', async (req, res) => {
  return handleNodesPeer(req, res)
})

router.get('/nodes/peers-p2p', (req, res) => {
  return handleNodesPeersP2p(req, res)
})

router.get('/nodes/api', (req, res) => {
  return handleNodesApi(req, res)
})

export default router
