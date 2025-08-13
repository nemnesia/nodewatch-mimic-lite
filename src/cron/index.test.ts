import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startJobs } from './index.js'
import * as nodeCron from 'node-cron'
import * as crawlerModule from './crawler.js'
import * as loggerModule from '../utils/logger.js'

// モックの設定
vi.mock('node-cron', () => {
  return {
    default: {
      schedule: vi.fn(),
    }
  }
})

vi.mock('./crawler.js', () => {
  return {
    crawler: vi.fn()
  }
})

vi.mock('../utils/logger.js', () => {
  return {
    getLogger: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })
  }
})

describe('cron index', () => {
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    // 環境変数のバックアップとリセット
    originalEnv = { ...process.env }
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // 環境変数の復元
    process.env = originalEnv
  })

  it('デフォルトのCRON_SCHEDULEが期待通りである', async () => {
    delete process.env.CRAWLER_CRON_SCHEDULE
    // モジュールを再インポートしてCRON_SCHEDULEを取得
    const module = await import('./index.js')
    expect(module.CRON_SCHEDULE).toBe('*/10 * * * *')
  })

  it('環境変数からCRON_SCHEDULEを読み込む', async () => {
    process.env.CRAWLER_CRON_SCHEDULE = '*/5 * * * *'
    // 環境変数を変更した後にモジュールを再インポートして値を確認
    const module = await import('./index.js')
    expect(module.CRON_SCHEDULE).toBe('*/5 * * * *')
  })

  it('startJobsがcron.scheduleを正しいスケジュールで呼び出す', async () => {
    const scheduleSpy = vi.spyOn(nodeCron.default, 'schedule')
    const logger = loggerModule.getLogger('cron')
    const loggerSpy = vi.spyOn(logger, 'info')
    
    // モジュールから最新のCRON_SCHEDULEを取得
    const module = await import('./index.js')
    startJobs()
    
    expect(scheduleSpy).toHaveBeenCalledTimes(1)
    expect(scheduleSpy).toHaveBeenCalledWith(module.CRON_SCHEDULE, expect.any(Function))
    expect(loggerSpy).toHaveBeenCalledWith(`Starting crawler with schedule: ${module.CRON_SCHEDULE}`)
  })

  it('スケジュールされたジョブがcrawler関数を呼び出す', () => {
    const crawlerSpy = vi.spyOn(crawlerModule, 'crawler')
    
    // cron.scheduleのモック実装を作成し、コールバック関数を直接実行
    vi.spyOn(nodeCron.default, 'schedule').mockImplementation((_, callback) => {
      // TypeScriptのエラーを回避するため型アサーションを使用
      const cb = callback as () => void
      cb()
      return {} as any
    })
    
    startJobs()
    
    expect(crawlerSpy).toHaveBeenCalledTimes(1)
  })
})
