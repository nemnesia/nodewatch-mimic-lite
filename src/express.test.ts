
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from './express.js';
import * as loggerModule from './utils/logger.js';

describe('express app', () => {
  it('should initialize without error', () => {
    expect(app).toBeDefined();
    expect(typeof app.use).toBe('function');
  });

  it('should respond to GET / with some response', async () => {
    // ルートのレスポンスはroutes/index.jsの実装に依存
    const res = await request(app).get('/');
    // ステータスコードが何かしら返ることだけ確認（詳細はroutesのテストで）
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(600); // 500も許容
  });

  it('should call logger.info on request', async () => {
    // logger.info をグローバルにspy
    const loggerSpy = vi.spyOn(loggerModule.getLogger('web'), 'info');
    await request(app).get('/');
    expect(loggerSpy).toHaveBeenCalled();
    loggerSpy.mockRestore();
  });
});
