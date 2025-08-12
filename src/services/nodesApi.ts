import { Request, Response } from 'express'

export async function handleNodesApi(req: Request, res: Response): Promise<void> {
  res.json([])
}
