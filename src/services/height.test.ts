import { handleHeight } from './height.js';
import { Request, Response } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('handleHeight', () => {
  const mockRequest = {} as Request;
  let mockResponse: Response;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock }));
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;
  });

  it('should return the median height and finalized height from trusted nodes', async () => {
    process.env.TRUSTED_NODES = 'http://node1.com,http://node2.com';

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ height: 100, latestFinalizedBlock: { height: 90 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ height: 200, latestFinalizedBlock: { height: 190 } }),
      }));

    await handleHeight(mockRequest, mockResponse);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(jsonMock).toHaveBeenCalledWith({ finalizedHeight: 190, height: 200 });
  });

  it('should return an error if no heights can be fetched', async () => {
    process.env.TRUSTED_NODES = 'http://node1.com,http://node2.com';

    // すべてのフェッチが失敗する場合
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ 
        ok: false, 
        statusText: 'Not Found' 
      })
      .mockResolvedValueOnce({ 
        ok: false, 
        statusText: 'Not Found' 
      }));

    await handleHeight(mockRequest, mockResponse);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ error: '全てのノードからheightの取得に失敗しました' });
  });

  it('should return an error if no trusted node has a height above the median', async () => {
    process.env.TRUSTED_NODES = 'http://node1.com,http://node2.com';
    process.env.NODE_ENV = 'test';

    // この特殊なケースでは、有効なレスポンスとheightの値があるが、
    // 中央値以上のheightを持つノードがない状況を作る
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ height: 10, latestFinalizedBlock: { height: 5 } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ height: 20, latestFinalizedBlock: { height: 15 } })
      }));

    await handleHeight(mockRequest, mockResponse);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ error: '中央値以上のheightを持つノードが見つかりません' });
  });
});
