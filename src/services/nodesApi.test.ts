import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleNodesApi } from './nodesApi.js';
import { Request, Response } from 'express';

describe('handleNodesApi', () => {
  const mockRequest = {} as Request;
  let mockResponse: Response;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    mockResponse = {
      json: jsonMock,
    } as unknown as Response;
  });

  it('should return an empty array', async () => {
    await handleNodesApi(mockRequest, mockResponse);
    
    expect(jsonMock).toHaveBeenCalledTimes(1);
    expect(jsonMock).toHaveBeenCalledWith([]);
  });
});
