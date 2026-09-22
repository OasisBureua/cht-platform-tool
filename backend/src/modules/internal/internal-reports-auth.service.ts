import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Shared-secret auth for cht-reports pulling registration data.
 * Same pattern as CacheClearService.assertCacheClearAuth: a bundled
 * app_secrets key, compared against X-BFF-Auth, same header name the
 * rest of the ecosystem (cht-companion, cht-reports) already uses for
 * service-to-service calls.
 */
@Injectable()
export class InternalReportsAuthService {
  private readonly logger = new Logger(InternalReportsAuthService.name);

  constructor(private readonly config: ConfigService) {}

  assertBffAuth(bffAuth?: string): void {
    const expected = this.config.get<string>('internalReports.secret')?.trim();
    if (!expected) {
      this.logger.error('Internal reports call rejected: INTERNAL_REPORTS_SECRET is not configured');
      throw new UnauthorizedException('Internal reports endpoint is not configured');
    }

    const provided = bffAuth?.trim();
    if (!provided) {
      this.logger.warn('Internal reports call rejected: missing X-BFF-Auth header');
      throw new UnauthorizedException('X-BFF-Auth header is required');
    }

    if (provided !== expected) {
      this.logger.warn('Internal reports call rejected: invalid X-BFF-Auth secret');
      throw new UnauthorizedException('Invalid X-BFF-Auth secret');
    }
  }
}
