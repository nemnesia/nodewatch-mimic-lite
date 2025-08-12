import { Request, Response } from 'express'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function handleNodesPeer(req: Request, res: Response): Promise<void> {
  try {
    const filePath = join(process.cwd(), 'public', 'nodeWatchPeers.json')
    const data = await readFile(filePath, 'utf-8')
    res.type('json').send(data)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: 'Failed to read nodeWatchPeers.json', message: errorMessage })
  }
}
