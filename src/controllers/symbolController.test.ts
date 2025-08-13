import request from 'supertest'
import express from 'express'
import router from './symbolController.js'
import { handleHeight } from '../services/height.js'
import { handleNodesApi } from '../services/nodesApi.js'
import { handleNodesPeer } from '../services/nodesPeer.js'
import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/height.js', () => ({
  handleHeight: vi.fn((req, res) => res.status(200).send('Height OK')),
}))

vi.mock('../services/nodesApi.js', () => ({
  handleNodesApi: vi.fn((req, res) => res.status(200).send('Nodes API OK')),
}))

vi.mock('../services/nodesPeer.js', () => ({
  handleNodesPeer: vi.fn((req, res) => res.status(200).send('Nodes Peer OK')),
}))

describe('symbolController', () => {
  const app = express()
  app.use(router)

  it('should call handleHeight on GET /height', async () => {
    const response = await request(app).get('/height')
    expect(response.status).toBe(200)
    expect(response.text).toBe('Height OK')
    expect(handleHeight).toHaveBeenCalled()
  })

  it('should call handleNodesPeer on GET /nodes/peer', async () => {
    const response = await request(app).get('/nodes/peer')
    expect(response.status).toBe(200)
    expect(response.text).toBe('Nodes Peer OK')
    expect(handleNodesPeer).toHaveBeenCalled()
  })

  it('should call handleNodesApi on GET /nodes/api', async () => {
    const response = await request(app).get('/nodes/api')
    expect(response.status).toBe(200)
    expect(response.text).toBe('Nodes API OK')
    expect(handleNodesApi).toHaveBeenCalled()
  })
})
