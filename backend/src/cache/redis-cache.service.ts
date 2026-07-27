import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Default TTL for catalog / KOL / Content Hub upstream reads (30m). */
export const CACHE_TTL_SECONDS = 1_800;

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis | null = null;
  private readonly ttlSeconds: number;

  constructor(private readonly config: ConfigService) {
    const configured = this.config.get<number>('redis.ttlSeconds');
    this.ttlSeconds =
      typeof configured === 'number' && configured > 0
        ? configured
        : CACHE_TTL_SECONDS;
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('redis.url')?.trim();
    if (!url) {
      this.logger.log(
        'REDIS_URL not configured, upstream cache disabled (direct fetches)',
      );
      return;
    }

    this.client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis error: ${err.message}`);
    });

    try {
      await this.client.connect();
      this.logger.log('Redis cache connected');
    } catch (err) {
      this.logger.warn(
        `Redis unavailable: cache disabled: ${err instanceof Error ? err.message : String(err)}`,
      );
      try {
        this.client.disconnect();
      } catch {
        /* ignore */
      }
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
    }
  }

  isEnabled(): boolean {
    return this.client?.status === 'ready';
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.isEnabled() || !this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(
        `Redis GET ${key} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.isEnabled() || !this.client) return;
    const ttl =
      typeof ttlSeconds === 'number' && ttlSeconds > 0
        ? ttlSeconds
        : this.ttlSeconds;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      this.logger.warn(
        `Redis SET ${key} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isEnabled() || !this.client) return;
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(
        `Redis DEL ${key} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Delete keys matching a glob pattern (e.g. `cht:catalog:*`). */
  async deleteByPattern(pattern: string): Promise<number> {
    if (!this.isEnabled() || !this.client) return 0;
    let cursor = '0';
    let deleted = 0;
    let batches = 0;
    const started = Date.now();
    try {
      do {
        const [next, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) {
          batches += 1;
          deleted += await this.client.del(...keys);
        }
      } while (cursor !== '0');
      this.logger.log(
        `Redis deleteByPattern pattern=${pattern} deleted=${deleted} batches=${batches} durationMs=${Date.now() - started}`,
      );
      return deleted;
    } catch (err) {
      this.logger.warn(
        `Redis SCAN/DEL ${pattern} failed after ${deleted} keys: ${err instanceof Error ? err.message : String(err)}`,
      );
      return deleted;
    }
  }
}
