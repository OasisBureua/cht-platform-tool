import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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
};

@Injectable()
export class CacheClearService {
  private readonly logger = new Logger(CacheClearService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: RedisCacheService,
  ) {}

  assertInternalSecret(
    authorization?: string,
    internalSecret?: string,
  ): void {
    const expected = this.config.get<string>('internalCache.secret')?.trim();
    if (!expected) {
      throw new UnauthorizedException('Cache clear is not configured');
    }

    const bearer = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    const provided = internalSecret?.trim() || bearer;
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid cache clear secret');
    }
  }

  async clear(scope: CacheClearScope = 'all'): Promise<CacheClearResult> {
    const patterns = cachePatternsForScope(scope);
    const deletedByPattern: Record<string, number> = {};

    if (!this.cache.isEnabled()) {
      this.logger.warn(`Cache clear (${scope}) requested but Redis is not connected`);
      for (const pattern of patterns) {
        deletedByPattern[pattern] = 0;
      }
      return { scope, enabled: false, deletedByPattern, total: 0 };
    }

    let total = 0;
    for (const pattern of patterns) {
      const count = await this.cache.deleteByPattern(pattern);
      deletedByPattern[pattern] = count;
      total += count;
    }

    this.logger.log(`Cache cleared scope=${scope} (${total} keys)`);
    return { scope, enabled: true, deletedByPattern, total };
  }
}
