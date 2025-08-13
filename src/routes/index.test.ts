import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import router from './index.js'

describe('Routes', () => {
  const app = express()
  app.use(router)

  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/unknown')
    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'Endpoint not found' })
  })

  it('should log debug for dev tools requests', async () => {
    const response = await request(app).get('/.well-known/test')
    expect(response.status).toBe(404)
  })
})
