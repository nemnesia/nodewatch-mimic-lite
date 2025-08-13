
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NodeWatchPeer } from '../types/nodeWatch.types.js'
import type { ChainInfo, NodeInfo, NodePeer, NodeServer } from '../types/rest.types.js'
import { crawler } from './crawler.js'

// グローバルモック
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const writeFile = vi.fn()
const fetchFn = vi.fn()

// モックデータ生成
function createMockNodePeer(host: string): NodePeer {
  return { host } as NodePeer
}
function createMockNodeInfo(name: string): NodeInfo {
  return {
    version: 1234,
    publicKey: 'pub',
    networkGenerationHashSeed: 'genHashSeed',
    roles: 1,
    port: 3000,
    networkIdentifier: 1,
    host: 'host',
    friendlyName: name,
    nodePublicKey: 'nodepub',
  } as NodeInfo
}
function createMockNodeServer(): NodeServer {
  return { serverInfo: { restVersion: '1.0.0' } } as NodeServer
}
function createMockChainInfo(height: number): ChainInfo {
  return {
    scoreHigh: '9',
    scoreLow: '0',
    height: String(height),
    latestFinalizedBlock: {
      finalizationEpoch: 1,
      finalizationPoint: 1,
      height: String(height),
      hash: 'hash',
    },
  } as ChainInfo
}

describe('crawler', () => {
  it('trustedNodesのうち1つがタイムアウトしても他のpeersが保存される', async () => {
    const trustedNodes = ['http://mock1', 'http://timeout']
    fetchFn.mockImplementation((url: string, opts?: any) => {
      if (url.startsWith('http://timeout')) {
        // AbortSignalがabortされたらエラーでreject
        return new Promise((_, reject) => {
          if (opts && opts.signal) {
            opts.signal.addEventListener('abort', () => {
              reject(new Error('aborted'))
            })
          }
        })
      }
      if (url.endsWith('/node/peers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([createMockNodePeer('host1')]),
        })
      }
      if (url.includes('host1')) {
        if (url.endsWith('/chain/info'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockChainInfo(100)) })
        if (url.endsWith('/node/info'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockNodeInfo('A')) })
        if (url.endsWith('/node/server'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockNodeServer()) })
      }
      return Promise.resolve({ ok: false, statusText: 'not found', json: () => Promise.resolve({}) })
    })

    await crawler({
      logger: logger as any,
      fetchFn,
      writeFile,
      trustedNodes,
      chunkNum: 2,
      timeoutMs: 10, // タイムアウトをすぐ発生させる
      heightThreshold: 10,
    })

    expect(writeFile).toHaveBeenCalledTimes(1)
    const [, json] = writeFile.mock.calls[0]
    const peers = JSON.parse(json) as NodeWatchPeer[]
    expect(peers.length).toBe(1)
    expect(peers[0].name).toBe('A')
  })
  it('trustedNodesのpeers取得で404が返る場合は空配列となる', async () => {
    const trustedNodes = ['http://mock404']
    fetchFn.mockImplementation((url: string) => {
      // /node/peers だけ404を返す
      if (url.endsWith('/node/peers')) {
        return Promise.resolve({ ok: false, statusText: 'not found', json: () => Promise.resolve({}) })
      }
      // 他のエンドポイントは呼ばれない想定
      return Promise.resolve({ ok: false, statusText: 'not found', json: () => Promise.resolve({}) })
    })

    await crawler({
      logger: logger as any,
      fetchFn,
      writeFile,
      trustedNodes,
      chunkNum: 2,
      timeoutMs: 1000,
      heightThreshold: 10,
    })

    expect(writeFile).toHaveBeenCalledTimes(1)
    const [, json] = writeFile.mock.calls[0]
    const peers = JSON.parse(json)
    expect(Array.isArray(peers)).toBe(true)
    expect(peers.length).toBe(0)
  })
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('peersが正しく保存される（正常系）', async () => {
    const trustedNodes = ['http://mock1', 'http://mock2']
    fetchFn.mockImplementation((url: string) => {
      if (url.endsWith('/node/peers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([createMockNodePeer('host1'), createMockNodePeer('host2')]),
        })
      }
      if (url.includes('host1')) {
        if (url.endsWith('/chain/info'))
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createMockChainInfo(100)),
          })
        if (url.endsWith('/node/info'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockNodeInfo('A')) })
        if (url.endsWith('/node/server'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockNodeServer()) })
      }
      if (url.includes('host2')) {
        if (url.endsWith('/chain/info'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockChainInfo(80)) })
        if (url.endsWith('/node/info'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockNodeInfo('B')) })
        if (url.endsWith('/node/server'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockNodeServer()) })
      }
      return Promise.resolve({
        ok: false,
        statusText: 'not found',
        json: () => Promise.resolve({}),
      })
    })

    await crawler({
      logger: logger as any,
      fetchFn,
      writeFile,
      trustedNodes,
      chunkNum: 2,
      timeoutMs: 1000,
      heightThreshold: 10,
    })

  expect(writeFile).toHaveBeenCalledTimes(1)
  const [, json] = writeFile.mock.calls[0]
  const peers = JSON.parse(json) as NodeWatchPeer[]
  // height中央値=90, 閾値=10 → 80未満は除外、host2(B)はheight=80で除外される
  expect(peers.length).toBe(1)
  expect(peers[0].name).toBe('A')
  })

  it('height中央値-閾値以下のpeerは除外される', async () => {
    const trustedNodes = ['http://mock1']
    fetchFn.mockImplementation((url: string) => {
      if (url.endsWith('/node/peers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([createMockNodePeer('host1'), createMockNodePeer('host2')]),
        })
      }
      if (url.includes('host1')) {
        if (url.endsWith('/chain/info'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockChainInfo(100)) })
        if (url.endsWith('/node/info'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockNodeInfo('A')) })
        if (url.endsWith('/node/server'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockNodeServer()) })
      }
      if (url.includes('host2')) {
        if (url.endsWith('/chain/info'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockChainInfo(50)) })
        if (url.endsWith('/node/info'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockNodeInfo('B')) })
        if (url.endsWith('/node/server'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(createMockNodeServer()) })
      }
      return Promise.resolve({ ok: false, statusText: 'not found', json: () => Promise.resolve({}) })
    })

    await crawler({
      logger: logger as any,
      fetchFn,
      writeFile,
      trustedNodes,
      chunkNum: 2,
      timeoutMs: 1000,
      heightThreshold: 40, // 100-40=60未満は除外
    })

    const [, json] = writeFile.mock.calls[0]
    const peers = JSON.parse(json) as NodeWatchPeer[]
  // height中央値=75, 閾値=40 → 35未満は除外、どちらも残る
  expect(peers.length).toBe(2)
  const names = peers.map(p => p.name).sort()
  expect(names).toEqual(['A', 'B'])
  })
})
