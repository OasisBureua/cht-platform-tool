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
import { CognitoService } from '../auth/cognito.service';

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

export type CacheClearAuthMethod = 'query' | 'bearer' | 'header' | 'm2m';

const M2M_CACHE_CLEAR_SCOPE_DEFAULT = 'platform/cache.clear';

@Injectable()
export class CacheClearService {
  private readonly logger = new Logger(CacheClearService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: RedisCacheService,
    private readonly cognito: CognitoService,
  ) {}

  /**
   * Validates cache clear auth:
   * 1. Cognito M2M Bearer with `platform/cache.clear` (Hub client), or
   * 2. Legacy shared secret via `cacheKey` / Bearer / `x-internal-secret`.
   */
  async assertCacheClearAuth(
    auth: CacheClearAuthInput,
  ): Promise<CacheClearAuthMethod> {
    const bearer = auth.authorization?.startsWith('Bearer ')
      ? auth.authorization.slice(7).trim()
      : '';

    // JWT-shaped Bearer → M2M only (do not treat as shared secret).
    if (bearer && bearer.split('.').length >= 3) {
      await this.assertM2mCacheClear(bearer);
      return 'm2m';
    }

    const expected = this.config.get<string>('internalCache.secret')?.trim();
    if (!expected) {
      this.logger.error(
        'Cache clear rejected: INTERNAL_CACHE_SECRET is not configured',
      );
      throw new UnauthorizedException('Cache clear is not configured');
    }

    const fromQuery = auth.cacheKey?.trim();
    const fromHeader = auth.internalSecret?.trim();
    const provided = fromQuery || bearer || fromHeader;

    if (!provided) {
      this.logger.warn(
        'Cache clear rejected: missing cacheKey query parameter (or Authorization / x-internal-secret)',
      );
      throw new BadRequestException(
        'cacheKey query parameter is required (must match INTERNAL_CACHE_SECRET), or Authorization Bearer M2M token with platform/cache.clear',
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

  private async assertM2mCacheClear(accessToken: string): Promise<void> {
    const m2mClientId =
      this.config.get<string>('cognito.m2mExportClientId')?.trim() || '';
    if (!m2mClientId || !this.cognito.isConfigured()) {
      this.logger.warn(
        'Cache clear rejected: M2M token presented but Cognito M2M is not configured',
      );
      throw new UnauthorizedException('M2M cache clear is not configured');
    }

    const requiredScope =
      this.config.get<string>('cognito.m2mCacheClearScope')?.trim() ||
      M2M_CACHE_CLEAR_SCOPE_DEFAULT;

    try {
      await this.cognito.verifyM2mAccessToken(accessToken, {
        allowedClientIds: [m2mClientId],
        requiredScope,
      });
      this.logger.log(
        `[M2M] cache clear ok requiredScope=${requiredScope}`,
      );
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code || '')
          : '';
      if (code === 'MISSING_SCOPE') {
        throw new UnauthorizedException(
          `Access token missing required scope ${requiredScope}`,
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[M2M] cache clear reject: ${message}`);
      throw new UnauthorizedException('Invalid M2M access token');
    }
  }

  /** @deprecated Use assertCacheClearAuth, kept for callers not yet migrated. */
  async assertInternalSecret(
    authorization?: string,
    internalSecret?: string,
  ): Promise<void> {
    await this.assertCacheClearAuth({ authorization, internalSecret });
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
