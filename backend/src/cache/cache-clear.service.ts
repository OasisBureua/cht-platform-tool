import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cachePatternsForScope,
  type CacheClearScope,
} from './cache-keys';
import { RedisCacheService } from './redis-cache.service';

export type CacheClearResult = {
  scope: CacheClearScope;
  enabled: boolean;
  deletedByPattern: Record<string, number>;
  total: number;
  durationMs: number;
};

export type CacheClearAuthInput = {
  cacheKey?: string;
  authorization?: string;
  internalSecret?: string;
};

export type CacheClearAuthMethod = 'query' | 'bearer' | 'header';

@Injectable()
export class CacheClearService {
  private readonly logger = new Logger(CacheClearService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: RedisCacheService,
  ) {}

  /**
   * Validates cache clear auth. Requires `cacheKey` query param (preferred) or
   * Authorization Bearer / x-internal-secret header with the same secret value.
   */
  assertCacheClearAuth(auth: CacheClearAuthInput): CacheClearAuthMethod {
    const expected = this.config.get<string>('internalCache.secret')?.trim();
    if (!expected) {
      this.logger.error('Cache clear rejected: INTERNAL_CACHE_SECRET is not configured');
      throw new UnauthorizedException('Cache clear is not configured');
    }

    const fromQuery = auth.cacheKey?.trim();
    const bearer = auth.authorization?.startsWith('Bearer ')
      ? auth.authorization.slice(7).trim()
      : '';
    const fromHeader = auth.internalSecret?.trim();
    const provided = fromQuery || bearer || fromHeader;

    if (!provided) {
      this.logger.warn(
        'Cache clear rejected: missing cacheKey query parameter (or Authorization / x-internal-secret)',
      );
      throw new BadRequestException(
        'cacheKey query parameter is required (must match INTERNAL_CACHE_SECRET)',
      );
    }

    if (provided !== expected) {
      this.logger.warn(
        `Cache clear rejected: invalid cache key (auth=${fromQuery ? 'query' : bearer ? 'bearer' : 'header'})`,
      );
      throw new UnauthorizedException('Invalid cache key');
    }

    if (fromQuery) return 'query';
    if (bearer) return 'bearer';
    return 'header';
  }

  /** @deprecated Use assertCacheClearAuth, kept for callers not yet migrated. */
  assertInternalSecret(
    authorization?: string,
    internalSecret?: string,
  ): void {
    this.assertCacheClearAuth({ authorization, internalSecret });
  }

  async clear(
    scope: CacheClearScope = 'all',
    meta?: { authMethod?: CacheClearAuthMethod },
  ): Promise<CacheClearResult> {
    const started = Date.now();
    const patterns = cachePatternsForScope(scope);
    const deletedByPattern: Record<string, number> = {};

    this.logger.log(
      `Cache clear started scope=${scope} patterns=[${patterns.join(', ')}] auth=${meta?.authMethod ?? 'unknown'}`,
    );

    if (!this.cache.isEnabled()) {
      this.logger.warn(
        `Cache clear aborted scope=${scope}: Redis is not connected`,
      );
      for (const pattern of patterns) {
        deletedByPattern[pattern] = 0;
      }
      return {
        scope,
        enabled: false,
        deletedByPattern,
        total: 0,
        durationMs: Date.now() - started,
      };
    }

    let total = 0;
    for (const pattern of patterns) {
      const count = await this.cache.deleteByPattern(pattern);
      deletedByPattern[pattern] = count;
      total += count;
      this.logger.log(`Cache clear pattern=${pattern} deleted=${count}`);
    }

    const durationMs = Date.now() - started;
    this.logger.log(
      `Cache clear finished scope=${scope} total=${total} durationMs=${durationMs}`,
    );
    return { scope, enabled: true, deletedByPattern, total, durationMs };
  }
}
