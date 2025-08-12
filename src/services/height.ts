import dotenv from 'dotenv'
import { Request, Response } from 'express'
import { NodeWatchHeight } from '../types/nodeWatch.types.js'
import { ChainInfo, NodeInfo, NodePeer, NodeServer } from '../types/rest.types.js'
import { getLogger } from '../utils/logger.js'
const logger = getLogger('web')

dotenv.config()

/**
 * 信頼できるノードのリスト
 */
const TRUSTED_NODES = (process.env.TRUSTED_NODES || '').split(',').map((url) => url.trim())

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
    await new Promise((resolve) => setTimeout(resolve, 500))
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

export async function handleHeight(req: Request, res: Response): Promise<void> {
  // 各ノードからheightを取得
  const allChainInfos = (
    await Promise.all(TRUSTED_NODES.map((url) => fetchNodeRest(url, '/chain/info')))
  ).flat() as ChainInfo[]

  // allChainInfosのheightの中央値を計算
  const heights = allChainInfos.map((node) => Number(node && node.height)).filter((h) => !isNaN(h))

  if (heights.length === 0) {
    logger.error('全てのノードからheightの取得に失敗しました')
    res.status(500).json({ error: '全てのノードからheightの取得に失敗しました' })
    return
  }

  const medianHeight = heights.sort((a, b) => a - b)[Math.floor(heights.length / 2)]

  // 中央値以上のheightを持つノードを1件取得
  const trustedNode = allChainInfos.find((node) => Number(node && node.height) >= medianHeight)

  if (!trustedNode) {
    logger.error('中央値以上のheightを持つノードが見つかりません')
    res.status(500).json({ error: '中央値以上のheightを持つノードが見つかりません' })
    return
  }

  const nodeWatchHeight: NodeWatchHeight = {
    finalizedHeight:
      trustedNode.latestFinalizedBlock && trustedNode.latestFinalizedBlock.height
        ? Number(trustedNode.latestFinalizedBlock.height)
        : 0,
    height: Number(trustedNode.height) || 0,
  }

  res.json(nodeWatchHeight)
}
