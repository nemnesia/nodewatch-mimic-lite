import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('dotenv', () => ({
  default: { config: vi.fn() }
}));

const listenMock = vi.fn((_port, cb) => { if (cb) cb(); });
vi.mock('./express.js', () => ({
  default: { listen: listenMock }
}));

const loggerInfoMock = vi.fn();
vi.mock('./utils/logger.js', () => ({
  getLogger: vi.fn(() => ({ info: loggerInfoMock }))
}));

describe('nodeWatchMimicLiteServer entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PORT = '';
    vi.resetModules();
  });

  it('should call dotenv.config, app.listen, and logger.info', async () => {
    await import('./nodeWatchMimicLiteServer.js');
    const dotenv = await import('dotenv');
    expect(dotenv.default.config).toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalled();
    expect(loggerInfoMock).toHaveBeenCalledTimes(4);
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('Server running'));
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('symbol/height'));
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('symbol/nodes/peer'));
  });

  it('should use process.env.PORT if set', async () => {
    vi.resetModules();
    process.env.PORT = '12345';
    await import('./nodeWatchMimicLiteServer.js');
    expect(listenMock).toHaveBeenCalledWith('12345', expect.any(Function));
  });
});
