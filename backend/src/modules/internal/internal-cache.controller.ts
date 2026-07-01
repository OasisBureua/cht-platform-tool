import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '../../cache/redis-cache.service';

/**
 * POST /internal/cache/catalog/clear — invalidate cached YouTube + Content Hub reads.
 * Called by Content Hub sync jobs after successful ingest (see cache-sync-contract.md).
 */
@Controller('internal/cache')
export class InternalCacheController {
  private readonly logger = new Logger(InternalCacheController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: RedisCacheService,
  ) {}

  @Post('catalog/clear')
  @HttpCode(204)
  async clearCatalogCache(
    @Headers('authorization') authorization?: string,
    @Headers('x-internal-secret') internalSecret?: string,
  ): Promise<void> {
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

    if (!this.cache.isEnabled()) {
      this.logger.warn('Cache clear requested but Redis is not connected');
      return;
    }

    const patterns = ['cht:catalog:*', 'cht:kol-network:*', 'cht:contenthub:*'];
    let total = 0;
    for (const pattern of patterns) {
      total += await this.cache.deleteByPattern(pattern);
    }
    this.logger.log(`Cache cleared (${total} keys)`);
  }
}
