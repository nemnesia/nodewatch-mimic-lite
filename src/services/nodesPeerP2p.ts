import { Request, Response } from 'express'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { NodeWatchKnownPeer } from '../types/nodeWatch.types.js'

export async function handleNodesPeersP2p(req: Request, res: Response): Promise<void> {
  try {
    const filePath = join(process.cwd(), 'public', 'nodeWatchPeers.json')
    const data = await readFile(filePath, 'utf-8')
    const parsedData = JSON.parse(data)

    const peersP2p = []
    let count = 0;
    for (const peer of parsedData) {
      if (count >= 10) break;
      count++;
      
      if (peer.roles & 3) {
        let roles: string | undefined = undefined
        if (peer.roles & 1) {
          roles = 'Peer'
        }
        if (peer.roles & 2) {
          if (roles) {
            roles += ', '
          }
          roles += 'Api'
        }
        if (peer.roles & 4) {
          if (roles) {
            roles += ', '
          }
          roles += 'Voting'
        }

        const knownPeer: NodeWatchKnownPeer = {
          publicKey: peer.mainPublicKey,
          endpoint: {
            host: peer.host,
            port: peer.port,
          },
          metadata: {
            name: peer.name,
            roles: roles!,
          },
        }

        peersP2p.push(knownPeer)
      }
    }

    res.type('json').send(peersP2p)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: 'Failed to read nodeWatchPeers.json', message: errorMessage })
  }
}
