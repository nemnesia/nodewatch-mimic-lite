export interface ChainInfo {
  scoreHigh: string
  scoreLow: string
  height: string
  latestFinalizedBlock: {
    finalizationEpoch: number
    finalizationPoint: number
    height: string
    hash: string
  }
}

export interface NodeInfo {
  version: number
  publicKey: string
  networkGenerationHashSeed: string
  roles: number
  port: number
  networkIdentifier: number
  host: string
  friendlyName: string
  nodePublicKey: string
}

export interface NodePeer extends NodeInfo {}

export interface NodeServer {
  serverInfo: {
    restVersion: string
    deployment: {
      deploymentTool: string
      deploymentToolVersion: string
      lastUpdatedDate: string
    }
  }
}
