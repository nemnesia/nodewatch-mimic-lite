import dotenv from 'dotenv'
import { writeFileSync } from 'fs'
import { URL } from 'url'
import { NodeWatchPeer } from '../types/nodeWatch.types.js'
import { ChainInfo, NodeInfo, NodePeer, NodeServer } from '../types/rest.types.js'
import { getLogger } from '../utils/logger.js'

dotenv.config()

const defaultLogger = getLogger('cron')
const defaultWriteFile = writeFileSync

// 設定値
export const DEFAULT_CHUNK_NUM = 10
export const DEFAULT_TIMEOUT_MS = 3000
export const HEIGHT_THRESHOLD = 20

/**
 * Crawlerの依存関係
 */
export interface CrawlerDeps {
  logger?: ReturnType<typeof getLogger>
  fetchFn?: typeof fetch
  writeFile?: typeof writeFileSync
  trustedNodes?: string[]
  chunkNum?: number
  timeoutMs?: number
  heightThreshold?: number
}

/**
 * 信頼できるノードのリストを取得する
 * @param env 環境変数
 * @returns 信頼できるノードのURLの配列
 */
export function getTrustedNodes(env = process.env): string[] {
  return (env.TRUSTED_NODES || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
}

/**
 * チャンク数を取得する
 * @param env 環境変数
 * @returns チャンク数
 */
export function getChunkNum(env = process.env): number {
  return Number(env.CHUNK_NUM) || DEFAULT_CHUNK_NUM
}

/**
 * タイムアウト時間を取得する
 * @param env 環境変数
 * @returns タイムアウト時間（ミリ秒）
 */
export function getTimeoutMs(env = process.env): number {
  return Number(env.TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
}

/**
 * 高さの閾値を取得する
 * @returns 高さの閾値
 */
export function getHeightThreshold(): number {
  return HEIGHT_THRESHOLD
}

// chunk分割ユーティリティ
function chunkArray<T>(arr: T[], size: number): T[][] {
  const res: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size))
  }
  return res
}

/**
 * 中央値を計算する
 * @param nums 数値の配列
 * @returns 中央値、または配列が空の場合はnull
 */
function calcMedian(nums: number[]): number | null {
  if (!nums.length) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * REST APIからデータを取得する
 * @param url ベースURL
 * @param path 特定のパス
 * @returns フェッチしたデータ、または失敗した場合はnull
 */
async function fetchNodeRest(
  url: string,
  path: string,
  fetchFn: typeof fetch,
  logger: ReturnType<typeof getLogger>,
  timeoutMs: number,
): Promise<ChainInfo | NodeInfo | NodePeer[] | NodeServer | null> {
  const parsedUrl = new URL(path, url)
  try {
    logger.info(`Fetching from ${parsedUrl}`)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetchFn(parsedUrl.toString(), { signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) {
      logger.warn(`Failed to fetch from ${parsedUrl}: ${response.statusText}`)
      return null
    }
    const data = await response.json()
    return data
  } catch (error) {
    logger.error(`Error fetching from ${parsedUrl}: ${error}`)
    return null
  }
}

/**
 * 指定された NodePeer から NodeWatchPeer 情報を取得
 * @param nodePeer 情報を取得する NodePeer
 * @returns NodeWatchPeer 情報、または取得に失敗した場合は null
 */
async function fetchNodeWatchPeer(
  nodePeer: NodePeer,
  fetchFn: typeof fetch,
  logger: ReturnType<typeof getLogger>,
  timeoutMs: number,
): Promise<NodeWatchPeer | null> {
  let protocol = 'https'
  let port = '3001'

  async function withTimeout<T>(promise: Promise<T>): Promise<T | null> {
    return Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ])
  }

  try {
    const chainInfoHttps = withTimeout(
      fetchNodeRest(
        `${protocol}://${nodePeer.host}:${port}`,
        '/chain/info',
        fetchFn,
        logger,
        timeoutMs,
      ),
    )
    let chainInfo = (await chainInfoHttps) as ChainInfo | null

    if (chainInfo === null) {
      logger.warn(`Node Peer is not reachable: ${nodePeer.host}`)
      protocol = 'http'
      port = '3000'
      chainInfo = (await withTimeout(
        fetchNodeRest(
          `${protocol}://${nodePeer.host}:${port}`,
          '/chain/info',
          fetchFn,
          logger,
          timeoutMs,
        ),
      )) as ChainInfo | null
      if (chainInfo === null) return null
    }

    const nodeInfoStart = Date.now()
    const [nodeInfo, nodeServer] = await Promise.all([
      withTimeout(
        fetchNodeRest(
          `${protocol}://${nodePeer.host}:${port}`,
          '/node/info',
          fetchFn,
          logger,
          timeoutMs,
        ),
      ),
      withTimeout(
        fetchNodeRest(
          `${protocol}://${nodePeer.host}:${port}`,
          '/node/server',
          fetchFn,
          logger,
          timeoutMs,
        ),
      ),
    ])
    const nodeInfoResponseTime = Date.now() - nodeInfoStart
    if (nodeInfo === null || nodeServer === null) return null

    const responseTime = nodeInfoResponseTime

    const nodeWatchPeer: NodeWatchPeer = {
      balance: 0,
      endpoint: `http://${nodePeer.host}:3000`,
      finalizedEpoch: chainInfo.latestFinalizedBlock.finalizationEpoch,
      finalizedHash: chainInfo.latestFinalizedBlock.hash,
      finalizedHeight: Number(chainInfo.latestFinalizedBlock.height),
      finalizedPoint: chainInfo.latestFinalizedBlock.finalizationPoint,
      height: Number(chainInfo.height),
      isHealthy: null,
      isSslEnabled: protocol === 'https',
      mainPublicKey: (nodeInfo as NodeInfo).publicKey,
      name: (nodeInfo as NodeInfo).friendlyName,
      nodePublicKey: (nodeInfo as NodeInfo).nodePublicKey,
      restVersion: (nodeServer as NodeServer).serverInfo.restVersion,
      roles: (nodeInfo as NodeInfo).roles,
      version: toHexDotString((nodeInfo as NodeInfo).version),
      responseTime,
    }
    return nodeWatchPeer
  } catch (error) {
    logger.error(`Error accessing Node Peer: ${nodePeer.host} - ${error}`)
    return null
  }
}

/**
 * NodePeerから重複したホストを除去
 * @param peers NodePeer配列
 * @returns 重複を除去したNodePeer配列
 */
function deduplicatePeers(peers: NodePeer[]): NodePeer[] {
  return Array.from(
    new Map(peers.filter((peer) => peer && !!peer.host).map((peer) => [peer.host, peer])).values(),
  )
}

/**
 * 数値を16進数のドット区切り文字列に変換
 * @param num 変換する数値
 * @returns 16進数のドット区切り文字列
 */
function toHexDotString(num: number): string {
  const hex = num.toString(16).padStart(8, '0')
  return (
    hex
      .match(/.{1,2}/g)
      ?.map((part) => (part.startsWith('0') ? part.slice(1) : part))
      .join('.') ?? ''
  )
}

/**
 * メイン処理
 */
export async function crawler({
  logger = defaultLogger,
  fetchFn = fetch,
  writeFile = defaultWriteFile,
  trustedNodes = getTrustedNodes(),
  chunkNum = getChunkNum(),
  timeoutMs = getTimeoutMs(),
  heightThreshold = getHeightThreshold(),
}: CrawlerDeps = {}): Promise<void> {
  logger.info('Crawler is starting...')
  logger.info(`Trusted nodes: ${trustedNodes.join(', ')}`)

  // 各ノードからpeersを取得
  const allPeers = (
    await Promise.all(
      trustedNodes.map((url) => fetchNodeRest(url, '/node/peers', fetchFn, logger, timeoutMs)),
    )
  ).flat() as NodePeer[]

  // hostで重複排除
  const uniqueNodePeers = deduplicatePeers(allPeers)

  logger.info(`Unique node peers count: ${uniqueNodePeers.length}`)

  // chunkNum個ずつ並列で処理
  const nodeWatchPeers: NodeWatchPeer[] = []
  for (const chunk of chunkArray(uniqueNodePeers, chunkNum)) {
    const results = await Promise.all(
      chunk.map((peer) => fetchNodeWatchPeer(peer, fetchFn, logger, timeoutMs)),
    )
    nodeWatchPeers.push(...results.filter((peer): peer is NodeWatchPeer => peer !== null))
  }

  // nodeWatchPeersからheightの中央値を計算
  const heights = nodeWatchPeers.map((peer) => Number(peer && peer.height)).filter((h) => !isNaN(h))
  const medianHeight = calcMedian(heights)
  if (medianHeight !== null) {
    logger.info(`Median height: ${medianHeight}`)
  } else {
    logger.error('No valid heights available to calculate median. 全てのpeer.height取得に失敗')
  }

  // height中央値-閾値以下のノードを除外
  const filteredNodeWatchPeers = nodeWatchPeers.filter((peer) => {
    if (medianHeight === null) return true
    const h = Number(peer && peer.height)
    return !isNaN(h) && h > medianHeight - heightThreshold
  })

  // レスポンスタイムが速い順にソート
  filteredNodeWatchPeers.sort((a, b) => (a.responseTime ?? 0) - (b.responseTime ?? 0))

  // JSON形式に変換
  const nodeWatchPeersJson = JSON.stringify(filteredNodeWatchPeers, undefined, 2)

  // publicに保存
  writeFile('public/nodeWatchPeers.json', nodeWatchPeersJson)
}
