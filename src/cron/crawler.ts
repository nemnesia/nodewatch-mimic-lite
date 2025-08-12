import dotenv from 'dotenv'
import { writeFileSync } from 'fs'
import { URL } from 'url'
import { NodeWatchPeer } from '../types/nodeWatch.types.js'
import { ChainInfo, NodeInfo, NodePeer, NodeServer } from '../types/rest.types.js'
import { getLogger } from '../utils/logger.js'
const logger = getLogger('cron')

dotenv.config()

/**
 * 信頼できるノードのリスト
 */
const TRUSTED_NODES = (process.env.TRUSTED_NODES || '').split(',').map((url) => url.trim())

/**
 * チャンクサイズ
 */
const CHUNK_NUM = Number(process.env.CHUNK_NUM) || 10

/**
 * タイムアウト時間
 */
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS) || 3000

/**
 * REST APIからデータを取得する
 * @param url ベースURL
 * @param path 特定のパス
 * @returns フェッチしたデータ、または失敗した場合はnull
 */
async function fetchNodeRest(
  url: string,
  path: string,
): Promise<ChainInfo | NodeInfo | NodePeer[] | NodeServer | null> {
  const parsedUrl = new URL(path, url)
  try {
    logger.info(`Fetching from ${parsedUrl}`)
    // await new Promise((resolve) => setTimeout(resolve, 100))
    const response = await fetch(parsedUrl.toString())
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
async function fetchNodeWatchPeer(nodePeer: NodePeer): Promise<NodeWatchPeer | null> {
  // タイムアウト(ms)
  let protocol = 'https'
  let port = '3001'

  // タイムアウト付きPromise
  function withTimeout<T>(promise: Promise<T>): Promise<T | null> {
    return Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ])
  }

  try {
    // /chain/info取得 (https)
    const chainInfoHttps = withTimeout(
      fetchNodeRest(`${protocol}://${nodePeer.host}:${port}`, '/chain/info'),
    )
    let chainInfo = (await chainInfoHttps) as ChainInfo | null

    // https失敗時はhttpで再試行
    if (chainInfo === null) {
      logger.warn(`Node Peer is not reachable: ${nodePeer.host}`)
      protocol = 'http'
      port = '3000'
      chainInfo = (await withTimeout(
        fetchNodeRest(`${protocol}://${nodePeer.host}:${port}`, '/chain/info'),
      )) as ChainInfo | null
      if (chainInfo === null) return null
    }

    // /node/info, /node/server を並列取得
    const nodeInfoStart = Date.now()
    const [nodeInfo, nodeServer] = await Promise.all([
      withTimeout(fetchNodeRest(`${protocol}://${nodePeer.host}:${port}`, '/node/info')),
      withTimeout(fetchNodeRest(`${protocol}://${nodePeer.host}:${port}`, '/node/server')),
    ])
    const nodeInfoResponseTime = Date.now() - nodeInfoStart
    if (nodeInfo === null || nodeServer === null) return null

    // nodeServer取得時間は nodeInfo取得と同じタイミングで計測
    const responseTime = nodeInfoResponseTime

    // NodeWatchPeer情報を作成
    const nodeWatchPeer: NodeWatchPeer = {
      balance: 0,
      endpoint: `${protocol}://${nodePeer.host}:${port}`,
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
export async function crawler() {
  logger.info('Crawler is starting...')
  logger.info(`Trusted nodes: ${TRUSTED_NODES.join(', ')}`)

  // 各ノードからpeersを取得
  const allPeers = (
    await Promise.all(TRUSTED_NODES.map((url) => fetchNodeRest(url, '/node/peers')))
  ).flat() as NodePeer[]

  // hostで重複排除
  const uniqueNodePeers = deduplicatePeers(allPeers)

  logger.info(`Unique node peers count: ${uniqueNodePeers.length}`)

  // chunkNum個ずつ並列で処理（.envから取得、なければ10）
  const nodeWatchPeers: NodeWatchPeer[] = []
  for (let i = 0; i < uniqueNodePeers.length; i += CHUNK_NUM) {
    const chunk = uniqueNodePeers.slice(i, i + CHUNK_NUM)
    const results = await Promise.all(chunk.map(fetchNodeWatchPeer))
    nodeWatchPeers.push(...results.filter((peer): peer is NodeWatchPeer => peer !== null))
  }

  // nodeWatchPeersからheightの中央値を計算
  const heights = nodeWatchPeers
    .map((peer) => Number(peer && peer.height))
    .filter((h) => !isNaN(h))
    .sort((a, b) => a - b)
  let medianHeight: number | null = null
  if (heights.length > 0) {
    const mid = Math.floor(heights.length / 2)
    medianHeight = heights.length % 2 === 0 ? (heights[mid - 1] + heights[mid]) / 2 : heights[mid]
    logger.info(`Median height: ${medianHeight}`)
  } else {
    logger.error('No valid heights available to calculate median. 全てのpeer.height取得に失敗')
  }

  // height中央値-20以下のノードを除外
  const filteredNodeWatchPeers = nodeWatchPeers.filter((peer) => {
    if (medianHeight === null) return true
    const h = Number(peer && peer.height)
    return !isNaN(h) && h > medianHeight - 20
  })

  // レスポンスタイムが速い順にソート
  filteredNodeWatchPeers.sort((a, b) => (a.responseTime ?? 0) - (b.responseTime ?? 0))

  // JSON形式に変換
  const nodeWatchPeersJson = JSON.stringify(filteredNodeWatchPeers, undefined, 2)

  // publicに保存
  writeFileSync('public/nodeWatchPeers.json', nodeWatchPeersJson)
}
