import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { CognitoService } from './cognito.service';

export const M2M_EXPORT_SCOPE_DEFAULT = 'platform/export.read';

/**
 * Cognito client_credentials guard for Hub → GET /api/export/* only.
 * Requires Bearer access token with scope platform/export.read from the
 * configured M2M client. Does not accept session cookies or cht-web tokens.
 */
@Injectable()
export class CognitoM2mAuthGuard implements CanActivate {
  private readonly logger = new Logger(CognitoM2mAuthGuard.name);

  constructor(
    private readonly cognitoService: CognitoService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & {
        id?: string;
        m2m?: { clientId: string; scope: string; sub: string };
      }
    >();
    const requestId = requestIdFrom(request);
    const path = (request.url || '').split('?')[0];

    const m2mClientId =
      this.configService.get<string>('cognito.m2mExportClientId')?.trim() || '';
    if (!m2mClientId || !this.cognitoService.isConfigured()) {
      this.logger.warn(
        `[M2M] reject reason=not_configured path=${path} requestId=${requestId}`,
      );
      throw new UnauthorizedException('M2M export auth is not configured');
    }

    const requiredScope =
      this.configService.get<string>('cognito.m2mExportScope')?.trim() ||
      M2M_EXPORT_SCOPE_DEFAULT;

    const authHeader = request.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      this.logger.warn(
        `[M2M] reject reason=missing_bearer path=${path} requestId=${requestId}`,
      );
      throw new UnauthorizedException('Missing Authorization Bearer token');
    }
    const [scheme, token] = authHeader.split(/\s+/);
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token?.trim()) {
      this.logger.warn(
        `[M2M] reject reason=missing_bearer path=${path} requestId=${requestId}`,
      );
      throw new UnauthorizedException('Missing Authorization Bearer token');
    }

    try {
      const claims = await this.cognitoService.verifyM2mAccessToken(
        token.trim(),
        {
          allowedClientIds: [m2mClientId],
          requiredScope,
        },
      );
      request.m2m = {
        clientId: claims.client_id || '',
        scope: claims.scope || '',
        sub: claims.sub,
      };
      this.logger.log(
        `[M2M] ok clientId=${claims.client_id || ''} path=${path} requestId=${requestId}`,
      );
      return true;
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code || '')
          : '';
      const message = err instanceof Error ? err.message : String(err);
      if (code === 'MISSING_SCOPE') {
        this.logger.warn(
          `[M2M] reject reason=missing_scope required=${requiredScope} path=${path} requestId=${requestId}`,
        );
        throw new ForbiddenException(
          `Access token missing required scope ${requiredScope}`,
        );
      }
      this.logger.warn(
        `[M2M] reject reason=invalid_token path=${path} requestId=${requestId} detail=${message}`,
      );
      throw new UnauthorizedException('Invalid M2M access token');
    }
  }
}

function requestIdFrom(req: Request & { id?: string }): string {
  const incoming = req.headers['x-request-id'];
  if (typeof incoming === 'string' && incoming.trim()) return incoming.trim();
  if (Array.isArray(incoming)) {
    const first = incoming.find((v) => typeof v === 'string' && v.trim());
    if (first?.trim()) return first.trim();
  }
  if (typeof req.id === 'string' && req.id.trim()) return req.id.trim();
  return '-';
}
