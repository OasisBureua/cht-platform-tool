import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { RedisCacheService } from '../../cache/redis-cache.service';
import { ReportGenerationLimitService } from './report-generation-limit.service';

const HOUR = 3_600_000;
// 2026-10-20T14:10:00Z: 50 minutes left in the hour, 9h50m left in the UTC day.
const NOW = Date.UTC(2026, 9, 20, 14, 10);

function config(perHour = 5, perDay = 20): ConfigService {
  const values: Record<string, number> = {
    'reports.generatePerHour': perHour,
    'reports.generatePerDay': perDay,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

/** Redis stand-in: a Map behind the RedisCacheService calls the limiter uses. */
function redis() {
  const store = new Map<string, number>();
  const cache = {
    isEnabled: () => true,
    increment: jest.fn(async (key: string): Promise<number | null> => {
      await Promise.resolve();
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    }),
    decrement: jest.fn(async (key: string) => {
      await Promise.resolve();
      const next = (store.get(key) ?? 0) - 1;
      if (next <= 0) store.delete(key);
      else store.set(key, next);
      return Math.max(0, next);
    }),
  };
  return { cache, store };
}

const noRedis = {
  isEnabled: () => false,
  increment: () => Promise.resolve(null),
  decrement: () => Promise.resolve(null),
} as unknown as RedisCacheService;

async function rejection(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (err) {
    return err as HttpException;
  }
  throw new Error('expected a 429');
}

describe('ReportGenerationLimitService (CPR-21)', () => {
  it('allows 5 an hour, then answers 429 with when to retry', async () => {
    const limits = new ReportGenerationLimitService(config(), noRedis);
    for (let i = 0; i < 5; i += 1) await limits.reserve('u1', NOW);

    const err = await rejection(limits.reserve('u1', NOW));
    expect(err.getStatus()).toBe(429);
    expect(err.getResponse()).toMatchObject({
      statusCode: 429,
      message:
        'You can generate up to 5 reports an hour. Try again in 50 minutes.',
      retryAfterSeconds: 3_000,
    });
    await expect(limits.reserve('u2', NOW)).resolves.toBeInstanceOf(Function);
  });

  it('caps the day at 20 across hours, until midnight UTC', async () => {
    const limits = new ReportGenerationLimitService(config(), noRedis);
    for (let hour = 0; hour < 4; hour += 1) {
      for (let i = 0; i < 5; i += 1)
        await limits.reserve('u1', NOW + hour * HOUR);
    }

    const later = NOW + 4 * HOUR; // 18:10 UTC, a fresh hour
    const err = await rejection(limits.reserve('u1', later));
    expect(err.getResponse()).toMatchObject({
      message: 'You can generate up to 20 reports a day. Try again in 6 hours.',
    });
    await expect(
      limits.reserve('u1', Date.UTC(2026, 9, 21, 0, 1)),
    ).resolves.toBeInstanceOf(Function);
  });

  it('does not count a refused request', async () => {
    const limits = new ReportGenerationLimitService(config(2, 5), noRedis);
    await limits.reserve('u1', NOW);
    await limits.reserve('u1', NOW);
    for (let i = 0; i < 3; i += 1) {
      expect((await rejection(limits.reserve('u1', NOW))).getStatus()).toBe(
        429,
      );
    }

    // The refusals left the day at 2 of 5.
    await limits.reserve('u1', NOW + HOUR);
    await limits.reserve('u1', NOW + HOUR);
    await limits.reserve('u1', NOW + 2 * HOUR);
    expect(
      (await rejection(limits.reserve('u1', NOW + 2 * HOUR))).getResponse(),
    ).toMatchObject({
      message: 'You can generate up to 5 reports a day. Try again in 8 hours.',
    });
  });

  it('gives the slot back on release, once', async () => {
    const limits = new ReportGenerationLimitService(config(1, 20), noRedis);
    const release = await limits.reserve('u1', NOW);
    await release();
    await release();

    await limits.reserve('u1', NOW);
    expect((await rejection(limits.reserve('u1', NOW))).getStatus()).toBe(429);
  });

  it('lets parallel requests in only up to the cap', async () => {
    const { cache } = redis();
    const limits = new ReportGenerationLimitService(
      config(2, 20),
      cache as unknown as RedisCacheService,
    );

    const results = await Promise.allSettled([
      limits.reserve('u1', NOW),
      limits.reserve('u1', NOW),
      limits.reserve('u1', NOW),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('counts in Redis with keys that expire at the end of each window', async () => {
    const { cache, store } = redis();
    const limits = new ReportGenerationLimitService(
      config(1, 20),
      cache as unknown as RedisCacheService,
    );

    await limits.reserve('u1', NOW);

    expect(cache.increment).toHaveBeenCalledWith(
      expect.stringMatching(/^cht:reports:generate:u1:hour:/),
      3_000,
    );
    expect(cache.increment).toHaveBeenCalledWith(
      expect.stringMatching(/^cht:reports:generate:u1:day:/),
      35_400,
    );
    expect([...store.values()]).toEqual([1, 1]);

    expect((await rejection(limits.reserve('u1', NOW))).getStatus()).toBe(429);
    expect(cache.decrement).toHaveBeenCalledTimes(1);
    expect(cache.decrement).toHaveBeenCalledWith(
      expect.stringMatching(/^cht:reports:generate:u1:hour:/),
    );
    expect([...store.values()]).toEqual([1, 1]);
  });

  it('gives back the hour slot too when the day is full', async () => {
    const { cache, store } = redis();
    const limits = new ReportGenerationLimitService(
      config(5, 1),
      cache as unknown as RedisCacheService,
    );
    await limits.reserve('u1', NOW);

    expect((await rejection(limits.reserve('u1', NOW))).getStatus()).toBe(429);
    expect(cache.decrement).toHaveBeenCalledTimes(2);
    expect([...store.values()]).toEqual([1, 1]);
  });

  it('counts a key in memory when its Redis INCR fails, both ways', async () => {
    const { cache, store } = redis();
    cache.increment.mockImplementation(async (key: string) => {
      await Promise.resolve();
      if (key.includes(':hour:')) return null;
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    });
    const limits = new ReportGenerationLimitService(
      config(1, 20),
      cache as unknown as RedisCacheService,
    );

    await limits.reserve('u1', NOW);
    expect((await rejection(limits.reserve('u1', NOW))).getStatus()).toBe(429);
    // The hour slot went back to memory, not to Redis.
    expect(cache.decrement).not.toHaveBeenCalled();

    const release = await limits.reserve('u2', NOW);
    await release();
    expect(cache.decrement).toHaveBeenCalledTimes(1);
    expect(cache.decrement).toHaveBeenCalledWith(
      expect.stringMatching(/^cht:reports:generate:u2:day:/),
    );
  });

  it('drops expired in-memory counts', async () => {
    const limits = new ReportGenerationLimitService(config(), noRedis);
    await limits.reserve('u1', NOW);
    await limits.reserve('u2', NOW + 48 * HOUR);
    expect([...limits['memory'].keys()]).toEqual([
      expect.stringMatching(/^cht:reports:generate:u2:hour:/),
      expect.stringMatching(/^cht:reports:generate:u2:day:/),
    ]);
  });

  it('honours limits set in config', async () => {
    const limits = new ReportGenerationLimitService(config(2, 3), noRedis);
    await limits.reserve('u1', NOW);
    await limits.reserve('u1', NOW);
    expect(
      (await rejection(limits.reserve('u1', NOW))).getResponse(),
    ).toMatchObject({
      message:
        'You can generate up to 2 reports an hour. Try again in 50 minutes.',
    });
  });
});
