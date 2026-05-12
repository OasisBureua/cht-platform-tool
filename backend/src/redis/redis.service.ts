import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private configService: ConfigService) {
    this.initializeRedis();
  }

  private initializeRedis() {
    const redisHost = this.configService.get<string>('redis.host');
    const redisPort = this.configService.get<number>('redis.port') ?? 6379;

    if (!redisHost) {
      this.logger.warn('⚠️  Redis not configured - caching disabled');
      return;
    }

    try {
      const useTls =
        this.configService.get<boolean>('redis.tls') ??
        redisHost?.includes('.cache.amazonaws.com');
      // Elasticache TLS often fails cert verification; allow bypass via REDIS_TLS_REJECT_UNAUTHORIZED=false
      const rejectUnauthorized =
        this.configService.get<boolean>('redis.tlsRejectUnauthorized') ?? true;
      this.client = new Redis({
        host: redisHost,
        port: redisPort,
        tls: useTls
          ? {
              rejectUnauthorized,
              checkServerIdentity: () => undefined,
            }
          : undefined,
        connectTimeout: 20000,
        commandTimeout: 20000,
        lazyConnect: true,
        enableReadyCheck: true,
        retryStrategy: (times) => {
          if (times > 10) {
            this.logger.error('❌ Redis connection failed after 10 retries');
            return null;
          }
          this.logger.debug(`Redis retry ${times}/10`);
          return Math.min(times * 100, 3000);
        },
      });

      this.client.on('connect', () => {
        this.logger.log(`✅ Connected to Redis at ${redisHost}:${redisPort}`);
      });

      this.client.on('error', (err) => {
        this.logger.error('❌ Redis error:', err.message);
      });

      this.client.on('ready', () => {
        this.logger.log('✅ Redis client ready');
      });
    } catch (error) {
      this.logger.error('❌ Failed to initialize Redis:', error);
      this.client = null;
    }
  }

  async set(key: string, value: any, ttl: number = 10800): Promise<void> {
    if (!this.client) {
      this.logger.debug(`⚠️  Cache disabled - skipping SET: ${key}`);
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttl, serialized);
      this.logger.log(
        `✅ SET: ${key} (TTL: ${ttl}s, Size: ${serialized.length} bytes)`,
      );
    } catch (error) {
      this.logger.error(`❌ SET failed for ${key}:`, error);
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) {
      this.logger.debug(`⚠️  Cache disabled - skipping GET: ${key}`);
      return null;
    }

    try {
      const value = await this.client.get(key);

      if (!value) {
        this.logger.log(`❌ MISS: ${key}`);
        return null;
      }

      const parsed = JSON.parse(value) as T;
      this.logger.log(`✅ HIT: ${key} (Size: ${value.length} bytes)`);
      return parsed;
    } catch (error) {
      this.logger.error(`❌ GET failed for ${key}:`, error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.del(key);
      this.logger.log(`🗑️  DEL: ${key}`);
    } catch (error) {
      this.logger.error(`❌ DEL failed for ${key}:`, error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        this.logger.log(
          `��️  Invalidated ${keys.length} keys matching: ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Pattern invalidation failed for ${pattern}:`,
        error,
      );
    }
  }

  keys = {
    session: (sessionId: string) => `session:${sessionId}`,
    user: (userId: string) => `user:${userId}`,
    authUser: (authId: string) => `auth:user:${authId}`,
    dashboardEarnings: (userId: string) => `dashboard:earnings:${userId}`,
    dashboardStats: (userId: string) => `dashboard:stats:${userId}`,
    programs: () => 'programs:list',
    enrollments: (userId: string) => `enrollments:${userId}`,
  };

  ttl = {
    session: 10800, // 3 hours
    dashboard: 300, // 5 minutes
    programs: 600, // 10 minutes
    user: 1800, // 30 minutes
  };

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }
}
