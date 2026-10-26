import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '../../cache/redis-cache.service';

interface LimitWindow {
  name: 'hour' | 'day';
  seconds: number;
  limit: number;
}

/**
 * CPR-21: per-admin caps on Generate and Regenerate, counted together in
 * fixed UTC windows (5 an hour, 20 a day by default). Only accepted requests
 * count. Redis-backed; without Redis the counts are kept in this process.
 */
@Injectable()
export class ReportGenerationLimitService {
  private readonly windows: LimitWindow[];
  private readonly memory = new Map<
    string,
    { count: number; expiresAt: number }
  >();

  constructor(
    config: ConfigService,
    private readonly cache: RedisCacheService,
  ) {
    this.windows = [
      {
        name: 'hour',
        seconds: 3_600,
        limit: config.get<number>('reports.generatePerHour') ?? 5,
      },
      {
        name: 'day',
        seconds: 86_400,
        limit: config.get<number>('reports.generatePerDay') ?? 20,
      },
    ];
  }

  /**
   * Take one Generate/Regenerate slot in every window, or 429 when that
   * would pass a cap. Counts first and checks after, so parallel requests
   * cannot both slip under the limit. Returns `release`, which gives the
   * slot back when the request is not accepted after all.
   */
  async reserve(
    userId: string,
    now = Date.now(),
  ): Promise<() => Promise<void>> {
    const taken: Array<{ key: string; inMemory: boolean }> = [];
    let released = false;
    const release = async () => {
      if (released) return;
      released = true;
      for (const { key, inMemory } of taken) {
        await this.decrement(key, inMemory);
      }
    };

    for (const window of this.windows) {
      const key = this.key(userId, window, now);
      const ttl = this.secondsLeft(window, now);
      const { count, inMemory } = await this.increment(key, ttl, now);
      taken.push({ key, inMemory });
      if (count > window.limit) {
        await release();
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            message: `You can generate up to ${window.limit} reports ${window.name === 'hour' ? 'an hour' : 'a day'}. Try again in ${waitLabel(ttl)}.`,
            retryAfterSeconds: ttl,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    return release;
  }

  /** INCR in Redis, or in this process when Redis is off or the INCR fails. */
  private async increment(
    key: string,
    ttlSeconds: number,
    now: number,
  ): Promise<{ count: number; inMemory: boolean }> {
    const count = await this.cache.increment(key, ttlSeconds);
    if (count !== null) return { count, inMemory: false };

    for (const [k, entry] of this.memory) {
      if (entry.expiresAt <= now) this.memory.delete(k);
    }
    const entry = this.memory.get(key) ?? {
      count: 0,
      expiresAt: now + ttlSeconds * 1000,
    };
    entry.count += 1;
    this.memory.set(key, entry);
    return { count: entry.count, inMemory: true };
  }

  /** Undo `increment` in the same store it counted in. */
  private async decrement(key: string, inMemory: boolean): Promise<void> {
    if (!inMemory) {
      await this.cache.decrement(key);
      return;
    }
    const entry = this.memory.get(key);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count <= 0) this.memory.delete(key);
  }

  private key(userId: string, window: LimitWindow, now: number): string {
    const bucket = Math.floor(now / 1000 / window.seconds);
    return `cht:reports:generate:${userId}:${window.name}:${bucket}`;
  }

  private secondsLeft(window: LimitWindow, now: number): number {
    const nowSeconds = Math.floor(now / 1000);
    return Math.max(1, window.seconds - (nowSeconds % window.seconds));
  }
}

function waitLabel(seconds: number): string {
  if (seconds < 3_600) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const hours = Math.ceil(seconds / 3_600);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}
