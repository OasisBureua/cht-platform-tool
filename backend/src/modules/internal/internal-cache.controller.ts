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
 * POST /internal/cache/clear?scope=catalog|contenthub|all
 * POST /internal/cache/catalog/clear  — legacy alias (clears all upstream cache)
 */
@Controller('internal/cache')
export class InternalCacheController {
  private readonly logger = new Logger(InternalCacheController.name);

  constructor(private readonly cacheClear: CacheClearService) {}

  @Post('clear')
  async clearCache(
    @Query('scope') scope?: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-internal-secret') internalSecret?: string,
  ) {
    this.cacheClear.assertInternalSecret(authorization, internalSecret);
    const resolved = parseScope(scope);
    return this.cacheClear.clear(resolved);
  }

  @Post('catalog/clear')
  @HttpCode(200)
  async clearCatalogCache(
    @Headers('authorization') authorization?: string,
    @Headers('x-internal-secret') internalSecret?: string,
  ) {
    this.cacheClear.assertInternalSecret(authorization, internalSecret);
    const result = await this.cacheClear.clear('all');
    this.logger.log(
      `Legacy catalog/clear cleared ${result.total} keys (scope=all)`,
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
