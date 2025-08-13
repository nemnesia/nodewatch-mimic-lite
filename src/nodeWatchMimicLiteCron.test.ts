import { describe, it, expect, vi } from 'vitest';

vi.mock('dotenv', () => ({
  default: { config: vi.fn() }
}));
vi.mock('./cron/index.js', () => ({
  startJobs: vi.fn()
}));

describe('nodeWatchMimicLiteCron entry', () => {
  it('should call dotenv.config and startJobs', async () => {
    const dotenv = await import('dotenv');
    const cron = await import('./cron/index.js');
    await import('./nodeWatchMimicLiteCron.js');

    expect(dotenv.default.config).toHaveBeenCalled();
    expect(cron.startJobs).toHaveBeenCalled();
  });
});
