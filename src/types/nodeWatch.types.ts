export interface NodeWatchPeer {
  balance: number
  endpoint: string
  finalizedEpoch: number
  finalizedHash: string
  finalizedHeight: number
  finalizedPoint: number
  height: number
  isHealthy: boolean | null
  isSslEnabled: boolean
  mainPublicKey: string
  name: string
  nodePublicKey: string
  restVersion: string
  roles: number
  version: string
  geoLocation?: {
    city: string
    continent: string
    country: string
    isp: string
    lat: number
    lon: number
    region: string
  }
  host: string
  port: number
  responseTime?: number
}

export interface NodeWatchHeight {
  finalizedHeight: number
  height: number
}

export interface NodeWatchKnownPeer {
  publicKey: string
  endpoint: {
    host: string
    port: number
  }
  metadata: {
    name: string
    roles: string
  }
}
