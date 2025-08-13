import { handleNodesPeer } from './nodesPeer.js';
import { Request, Response } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import { join } from 'path';

// fs/promises の readFile 関数をモック化
vi.mock('fs/promises', () => ({
  readFile: vi.fn()
}));

describe('handleNodesPeer', () => {
  let mockRequest: Request;
  let mockResponse: Response;

  beforeEach(() => {
    mockRequest = {} as Request;
    
    // モックのリセット
    vi.resetAllMocks();
    
    // Expressのレスポンスオブジェクトのモック
    const mockJson = vi.fn();
    const mockSend = vi.fn();
    const mockStatus = vi.fn().mockReturnThis();
    const mockType = vi.fn().mockReturnThis();
    
    mockResponse = {
      json: mockJson,
      send: mockSend,
      status: mockStatus,
      type: mockType
    } as unknown as Response;
  });

  it('should return nodeWatchPeers.json content when file exists', async () => {
    // テスト用のダミーデータ
    const mockPeersData = JSON.stringify({
      peers: [
        { url: 'http://example.com/node1', friendlyName: 'Node 1' },
        { url: 'http://example.com/node2', friendlyName: 'Node 2' }
      ]
    });

    // readFile のモックが成功を返すよう設定
    (fs.readFile as any).mockResolvedValue(mockPeersData);

    await handleNodesPeer(mockRequest, mockResponse);

    // 正しいパスでファイルを読み込んだか確認
    expect(fs.readFile).toHaveBeenCalledWith(
      join(process.cwd(), 'public', 'nodeWatchPeers.json'),
      'utf-8'
    );

    // レスポンスの型とデータが正しいか確認
    expect(mockResponse.type).toHaveBeenCalledWith('json');
    expect(mockResponse.send).toHaveBeenCalledWith(mockPeersData);
  });

  it('should return 500 error when file read fails', async () => {
    // readFile のモックがエラーを投げるよう設定
    const errorMessage = 'File not found';
    (fs.readFile as any).mockRejectedValue(new Error(errorMessage));

    await handleNodesPeer(mockRequest, mockResponse);

    // エラーハンドリングが正しく行われたか確認
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Failed to read nodeWatchPeers.json',
      message: errorMessage
    });
  });

  it('should handle non-Error objects thrown during file read', async () => {
    // readFile のモックが文字列エラーを投げるよう設定
    const errorString = 'Something went wrong';
    (fs.readFile as any).mockRejectedValue(errorString);

    await handleNodesPeer(mockRequest, mockResponse);

    // エラー処理が文字列エラーも適切に処理するか確認
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Failed to read nodeWatchPeers.json',
      message: errorString
    });
  });
});
