import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { CacheClearService } from '../../cache/cache-clear.service';
import type { CacheClearScope } from '../../cache/cache-keys';

/**
 * Internal cache invalidation for sync jobs and ops (see docs/runbooks/cache-sync-contract.md).
 *
 * POST /internal/cache/clear?scope=catalog|contenthub|all&cacheKey=<INTERNAL_CACHE_SECRET>
 * POST /internal/cache/clear/all?cacheKey=<INTERNAL_CACHE_SECRET>  — all namespaces
 * POST /internal/cache/catalog/clear?cacheKey=...  — legacy alias (clears all upstream cache)
 */
@Controller('internal/cache')
export class InternalCacheController {
  private readonly logger = new Logger(InternalCacheController.name);

  constructor(private readonly cacheClear: CacheClearService) {}

  @Post('clear')
  async clearCache(
    @Query('scope') scope?: string,
    @Query('cacheKey') cacheKey?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-internal-secret') internalSecret?: string,
  ) {
    const authMethod = this.cacheClear.assertCacheClearAuth({
      cacheKey,
      authorization,
      internalSecret,
    });
    const resolved = parseScope(scope);
    this.logger.log(
      `POST /internal/cache/clear scope=${resolved} auth=${authMethod}`,
    );
    return this.cacheClear.clear(resolved, { authMethod });
  }

  @Post('clear/all')
  @HttpCode(200)
  async clearAllNamespaces(
    @Query('cacheKey') cacheKey?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-internal-secret') internalSecret?: string,
  ) {
    const authMethod = this.cacheClear.assertCacheClearAuth({
      cacheKey,
      authorization,
      internalSecret,
    });
    this.logger.log(`POST /internal/cache/clear/all auth=${authMethod}`);
    return this.cacheClear.clear('all', { authMethod });
  }

  @Post('catalog/clear')
  @HttpCode(200)
  async clearCatalogCache(
    @Query('cacheKey') cacheKey?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-internal-secret') internalSecret?: string,
  ) {
    const authMethod = this.cacheClear.assertCacheClearAuth({
      cacheKey,
      authorization,
      internalSecret,
    });
    this.logger.log(
      `POST /internal/cache/catalog/clear (legacy → scope=all) auth=${authMethod}`,
    );
    const result = await this.cacheClear.clear('all', { authMethod });
    this.logger.log(
      `Legacy catalog/clear finished total=${result.total} durationMs=${result.durationMs}`,
    );
    return result;
  }
}

function parseScope(raw?: string): CacheClearScope {
  const scope = raw?.trim().toLowerCase();
  if (!scope || scope === 'all') return 'all';
  if (scope === 'catalog' || scope === 'contenthub') return scope;
  throw new BadRequestException(
    'Invalid scope — use catalog, contenthub, or all',
  );
}
