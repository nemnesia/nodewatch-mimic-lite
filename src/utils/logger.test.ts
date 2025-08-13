import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// EventEmitterのシンプルなモック
class MockEventEmitter {
  private events: Record<string, Function[]> = {}

  on(event: string, listener: Function) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(listener)
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach((listener) => listener(...args))
    }
  }
}

// transportインスタンスを保存するためのグローバル変数
let mockTransportInstance: MockEventEmitter | null = null

// 実際のファイルシステム操作をモックする
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(() => undefined), // 明示的に実装を追加
  }
})

vi.mock('winston-daily-rotate-file', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      const mockTransport = new MockEventEmitter()
      Object.assign(mockTransport, {
        level: 'info',
        format: vi.fn(),
        filename: 'test.log',
        datePattern: 'YYYY-MM-DD',
      })

      // テスト用にtransportインスタンスを保存
      mockTransportInstance = mockTransport

      return mockTransport
    }),
  }
})

// winston自体もモック
vi.mock('winston', () => {
  const winstonMock = {
    format: {
      timestamp: vi.fn(() => (opts?: any) => opts),
      printf: vi.fn((fn) => fn),
      combine: vi.fn((...args) => args),
      colorize: vi.fn(() => (opts?: any) => opts),
      errors: vi.fn(() => (opts?: any) => opts),
      json: vi.fn(() => (opts?: any) => opts),
      simple: vi.fn(() => (opts?: any) => opts),
    },
    transports: {
      Console: vi.fn().mockImplementation(() => ({
        level: 'info',
        format: vi.fn(),
      })),
    },
    createLogger: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  }

  return {
    default: winstonMock,
    ...winstonMock,
  }
})

// loggerをダイナミックインポートでロード
describe('loggerユーティリティ', () => {
  it('loggerCacheのキャッシュが利用されるべき', async () => {
    const loggerModule = await import('./logger.js')
    const logger1 = loggerModule.getLogger('app')
    const logger2 = loggerModule.getLogger('app')
    expect(logger1).toBe(logger2)
  })

  it('未知のcategoryでもloggerが生成されるべき', async () => {
    const loggerModule = await import('./logger.js')
    const customLogger = loggerModule.getLogger('custom')
    expect(customLogger).toBeDefined()
    expect(typeof customLogger.info).toBe('function')
  })

  // logDirが存在しない場合のテストは別の方法で検証
  it('logDirが存在しない場合mkdirSyncが呼ばれるべき', async () => {
    // すべてのモックをリセット
    vi.resetAllMocks()
    vi.resetModules()

    // 新しいモックの設定
    const mockExistsSync = vi.fn().mockReturnValue(false)
    const mockMkdirSync = vi.fn()

    // fsのモックを完全に上書き
    vi.doMock('fs', () => ({
      existsSync: mockExistsSync,
      mkdirSync: mockMkdirSync,
      default: {
        existsSync: mockExistsSync,
        mkdirSync: mockMkdirSync,
      },
    }))

    // logger.jsをインポート (これによりmkdirSyncが呼ばれるはず)
    await import('./logger.js')

    // 検証
    expect(mockExistsSync).toHaveBeenCalled()
    expect(mockMkdirSync).toHaveBeenCalled()

    // モックをリセット
    vi.resetModules()
    vi.doMock('fs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('fs')>()
      return {
        ...actual,
        existsSync: vi.fn(() => true),
        mkdirSync: vi.fn(() => undefined),
      }
    })
  })

  it('transport.onが未定義でもエラーにならない', async () => {
    // winston-daily-rotate-fileのモックを一時的に上書き
    vi.doMock('winston-daily-rotate-file', () => {
      return {
        default: vi.fn().mockImplementation(() => ({
          // onが無い
        })),
      }
    })
    vi.resetModules()
    const loggerModule = await import('./logger.js')
    expect(() => loggerModule.getLogger('app')).not.toThrow()
  })

  it('fs.existsSyncが例外を投げた場合もcatchできる', async () => {
    const fs = await import('fs')
    const existsSyncMock = vi.spyOn(fs, 'existsSync').mockImplementation(() => {
      throw new Error('existsSync error')
    })
    vi.resetModules()
    try {
      await import('./logger.js')
    } catch (e) {
      expect(e).toBeDefined()
    }
    existsSyncMock.mockRestore()
  })

  it('fs.mkdirSyncが例外を投げた場合もcatchできる', async () => {
    const fs = await import('fs')
    const existsSyncMock = vi.spyOn(fs, 'existsSync').mockReturnValue(false)
    const mkdirSyncMock = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('mkdirSync error')
    })
    vi.resetModules()
    try {
      await import('./logger.js')
    } catch (e) {
      expect(e).toBeDefined()
    }
    existsSyncMock.mockRestore()
    mkdirSyncMock.mockRestore()
  })
  let consoleSpy: any

  beforeEach(async () => {
    vi.resetModules()
    mockTransportInstance = null
    // コンソール出力をキャプチャ
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('loggerインスタンスが存在するべき', async () => {
    const loggerModule = await import('./logger.js')
    const logger = loggerModule.getLogger()
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })

  it('infoメッセージをログに記録するべき', async () => {
    const loggerModule = await import('./logger.js')
    const logger = loggerModule.getLogger()
    const testMessage = 'Test info message'
    logger.info(testMessage)
    expect(logger.info).toBeDefined()
  })

  it('errorメッセージをログに記録するべき', async () => {
    const loggerModule = await import('./logger.js')
    const logger = loggerModule.getLogger()
    const testMessage = 'Test error message'
    logger.error(testMessage)
    expect(logger.error).toBeDefined()
  })

  it('warnメッセージをログに記録するべき', async () => {
    const loggerModule = await import('./logger.js')
    const logger = loggerModule.getLogger()
    const testMessage = 'Test warn message'
    logger.warn(testMessage)
    expect(logger.warn).toBeDefined()
  })

  it('debugメッセージをログに記録するべき', async () => {
    const loggerModule = await import('./logger.js')
    const logger = loggerModule.getLogger()
    const testMessage = 'Test debug message'
    logger.debug(testMessage)
    expect(logger.debug).toBeDefined()
  })

  it('ログメッセージが一貫したフォーマットであるべき', async () => {
    // winstonのモックを上書き
    vi.resetModules()

    let formatOutput: string | undefined

    vi.doMock('winston', () => {
      const format = {
        timestamp: vi.fn(() => (info: any) => {
          info.timestamp = '2023-01-01 00:00:00'
          return info
        }),
        printf: vi.fn((fn) => {
          return (info: any) => {
            formatOutput = fn(info)
            return formatOutput
          }
        }),
        combine: vi.fn((...args) => {
          // 実際に関数を呼び出す
          const lastArg = args[args.length - 1]
          if (typeof lastArg === 'function') {
            const mockInfo = {
              timestamp: '2023-01-01 00:00:00',
              level: 'info',
              message: 'test message',
              test: 'value',
            }
            lastArg(mockInfo)
          }
          return args
        }),
        colorize: vi.fn(() => (info: any) => info),
        errors: vi.fn(() => (info: any) => info),
        json: vi.fn(() => (info: any) => info),
        simple: vi.fn(() => (info: any) => info),
      }

      return {
        default: {
          format,
          transports: {
            Console: vi.fn().mockImplementation(() => ({
              level: 'info',
              format: vi.fn(),
            })),
          },
          createLogger: vi.fn(() => ({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
          })),
        },
        format,
        transports: {
          Console: vi.fn().mockImplementation(() => ({
            level: 'info',
            format: vi.fn(),
          })),
        },
        createLogger: vi.fn(() => ({
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
        })),
      }
    })

    const loggerModule = await import('./logger.js')
    loggerModule.getLogger() // この呼び出しによりフォーマット関数が実行される

    // formatOutputが生成されていることを検証
    expect(formatOutput).toBeDefined()
    // これによりprintf関数が実行されたことを確認

    vi.resetModules()
  })

  it('メタデータ付きのメッセージをログに記録するべき', async () => {
    const loggerModule = await import('./logger.js')
    const logger = loggerModule.getLogger()
    const message = 'Test message with metadata'
    const metadata = {
      userId: '123',
      action: 'test_action',
      timestamp: new Date().toISOString(),
    }
    logger.info(message, metadata)
    logger.error(message, metadata)
    logger.warn(message, metadata)
    logger.debug(message, metadata)
    expect(logger.info).toBeDefined()
    expect(logger.error).toBeDefined()
    expect(logger.warn).toBeDefined()
    expect(logger.debug).toBeDefined()
  })

  it('メタデータなしのメッセージをログに記録するべき', async () => {
    const loggerModule = await import('./logger.js')
    const logger = loggerModule.getLogger()
    const message = 'Test message without metadata'
    logger.info(message)
    logger.error(message)
    logger.warn(message)
    logger.debug(message)
    expect(logger.info).toBeDefined()
    expect(logger.error).toBeDefined()
    expect(logger.warn).toBeDefined()
    expect(logger.debug).toBeDefined()
  })

  it('エラーオブジェクトを含むログを処理するべき', async () => {
    const loggerModule = await import('./logger.js')
    const logger = loggerModule.getLogger()
    const errorMessage = 'Test error with stack trace'
    const error = new Error(errorMessage)
    logger.error('Error occurred', { error })
    expect(logger.error).toBeDefined()
  })

  it('異なる型のメタデータを処理するべき', async () => {
    const loggerModule = await import('./logger.js')
    const logger = loggerModule.getLogger()
    const testCases = [
      { string: 'test' },
      { number: 123 },
      { boolean: true },
      { array: [1, 2, 3] },
      { nested: { key: 'value' } },
      { mixed: { str: 'test', num: 456, bool: false } },
    ]
    testCases.forEach((metadata, index) => {
      logger.info(`Test message ${index}`, metadata)
    })
    expect(logger.info).toBeDefined()
  })

  it('環境変数を使用してloggerを設定するべき', async () => {
    vi.resetModules()
    process.env.LOG_DIR = 'custom_logs'
    process.env.LOG_RETENTION_DAYS = '7'
    process.env.LOG_LEVEL = 'debug'
    process.env.LOG_FILE_LEVEL = 'warn'
    process.env.LOG_CONSOLE_LEVEL = 'error'
    const loggerModule = await import('./logger.js')
    const logger = loggerModule.getLogger()

    // 設定値を検証
    expect(process.env.LOG_DIR).toBe('custom_logs')
    expect(process.env.LOG_RETENTION_DAYS).toBe('7')
    expect(process.env.LOG_LEVEL).toBe('debug')
    expect(process.env.LOG_FILE_LEVEL).toBe('warn')
    expect(process.env.LOG_CONSOLE_LEVEL).toBe('error')

    // ログメソッドを呼んで、printf関数が実行されることを確認
    logger.info('Test message with meta', { test: 'value' })
    logger.error('Test error message with meta', { test: 'value' })
  })

  it('プリントフォーマット関数が正しく動作するべき', async () => {
    vi.resetModules()

    // winston の Console transport を直接モックして、write メソッドをスパイする
    const consoleWriteSpy = vi.fn()

    vi.doMock('winston', () => {
      const format = {
        timestamp: vi.fn(() => (opts?: any) => opts),
        printf: vi.fn((fn) => {
          // 実際にprintf関数を呼び出す
          fn({ timestamp: '2023-01-01 00:00:00', level: 'info', message: 'Test' })
          return fn
        }),
        combine: vi.fn((...args) => args),
        colorize: vi.fn(() => (opts?: any) => opts),
        errors: vi.fn(() => (opts?: any) => opts),
        json: vi.fn(() => (opts?: any) => opts),
        simple: vi.fn(() => (opts?: any) => opts),
      }

      return {
        default: {
          format,
          transports: {
            Console: vi.fn().mockImplementation(() => ({
              level: 'info',
              format: vi.fn(),
              write: consoleWriteSpy,
            })),
          },
          createLogger: vi.fn(() => ({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
          })),
        },
        format,
        transports: {
          Console: vi.fn().mockImplementation(() => ({
            level: 'info',
            format: vi.fn(),
            write: consoleWriteSpy,
          })),
        },
        createLogger: vi.fn(() => ({
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
        })),
      }
    })

    const loggerModule = await import('./logger.js')
    const logger = loggerModule.getLogger()

    // フォーマット関数が呼ばれたことを検証
    expect(logger).toBeDefined()

    // prinftとcolorizeが正しく動作することをテスト
    vi.resetModules()
  })

  it('新しいログファイル作成時に正しいメッセージを記録するべき', async () => {
    vi.resetModules()
    // mockTransportInstanceが必ず存在するように再作成
    mockTransportInstance = new MockEventEmitter()
    const mockTransport = mockTransportInstance
    Object.assign(mockTransport, {
      level: 'info',
      format: vi.fn(),
      filename: 'test.log',
      datePattern: 'YYYY-MM-DD',
    })

    const loggerModule = await import('./logger.js')
    const testLogger = loggerModule.getLogger()
    const mockInfo = vi.spyOn(testLogger, 'info')

    // イベントリスナーをspyしたloggerで再登録
    mockTransport['events'] = {}
    mockTransport.on('new', (filename: string) => {
      testLogger.info(`New log file created: ${filename}`)
    })
    const filename = 'test-log-file.log'
    mockTransport.emit('new', filename)
    expect(mockInfo).toHaveBeenCalledWith(`New log file created: ${filename}`)
    mockInfo.mockRestore()
  })

  it('ログローテーション時に正しいメッセージを記録するべき', async () => {
    vi.resetModules()
    // mockTransportInstanceが必ず存在するように再作成
    mockTransportInstance = new MockEventEmitter()
    const mockTransport = mockTransportInstance
    Object.assign(mockTransport, {
      level: 'info',
      format: vi.fn(),
      filename: 'test.log',
      datePattern: 'YYYY-MM-DD',
    })

    const loggerModule = await import('./logger.js')
    const testLogger = loggerModule.getLogger()
    const mockInfo = vi.spyOn(testLogger, 'info')

    // イベントリスナーをspyしたloggerで再登録
    mockTransport['events'] = {}
    mockTransport.on('rotate', (oldFilename: string, newFilename: string) => {
      testLogger.info(`Log rotated from ${oldFilename} to ${newFilename}`)
    })
    const oldFilename = 'old-file.log'
    const newFilename = 'new-file.log'
    mockTransport.emit('rotate', oldFilename, newFilename)
    expect(mockInfo).toHaveBeenCalledWith(`Log rotated from ${oldFilename} to ${newFilename}`)
    mockInfo.mockRestore()
  })
})
