import { describe, it, expect, vi } from 'vitest';

vi.mock('dotenv', () => ({
  default: { config: vi.fn() }
}));
vi.mock('./cron/crawler.js', () => ({
  crawler: vi.fn()
}));

describe('oneshotCron entry', () => {
  it('should call dotenv.config and crawler', async () => {
    const dotenv = await import('dotenv');
    const crawlerModule = await import('./cron/crawler.js');
    await import('./oneshotCron.js');

    expect(dotenv.default.config).toHaveBeenCalled();
    expect(crawlerModule.crawler).toHaveBeenCalled();
  });
});
