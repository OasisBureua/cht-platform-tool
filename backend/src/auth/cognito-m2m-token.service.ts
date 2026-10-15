import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CachedToken = {
  accessToken: string;
  /** Epoch ms when we should refresh (before Cognito expiry). */
  refreshAtMs: number;
};

/**
 * In-memory Cognito client_credentials cache for the platform outbound M2M
 * client (cht-{env}-cognito-m2m-platform).
 * Warms the Hub token on boot so the first catalog/admin Hub call is not
 * blocked on token POST.
 *
 * One client, one token per scope (same pattern as cht-reports): the hub/…
 * scopes for Content Hub (the default), companion/chat.invoke for Companion.
 *
 * Logging policy: success and failure outcomes are OK to log.
 * Never log access_token, client_secret, or Authorization headers.
 */
@Injectable()
export class CognitoM2mTokenService implements OnModuleInit {
  private readonly logger = new Logger(CognitoM2mTokenService.name);
  private readonly cache = new Map<string, CachedToken>();
  private readonly inflight = new Map<string, Promise<string>>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        '[M2M] Platform→Hub token warm skipped (COGNITO_M2M_PLATFORM_* not configured)',
      );
      return;
    }
    try {
      await this.getAccessToken();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[M2M] Platform→Hub token warm failed: ${message} (Hub calls will retry on demand)`,
      );
    }
  }

  isConfigured(): boolean {
    return !!(
      this.clientId() &&
      this.clientSecret() &&
      this.tokenUrl() &&
      this.hubScopes()
    );
  }

  /**
   * Bearer access token for `scope` (default: the Hub scopes). Served from
   * cache until ~60s before expiry; concurrent callers share one request.
   * Throws UnauthorizedException when M2M is not configured or mint fails.
   */
  async getAccessToken(scope: string = this.hubScopes()): Promise<string> {
    if (!this.isConfigured()) {
      throw new UnauthorizedException(
        'Platform M2M is not configured (missing platform outbound credentials)',
      );
    }

    const cached = this.cache.get(scope);
    if (cached && cached.refreshAtMs > Date.now()) {
      return cached.accessToken;
    }

    const pending = this.inflight.get(scope);
    if (pending) {
      return pending;
    }

    const request = this.fetchAndCache(scope).finally(() => {
      this.inflight.delete(scope);
    });
    this.inflight.set(scope, request);
    return request;
  }

  /** Drop the cached token for `scope`, e.g. after the server answers 401 to it. */
  invalidate(scope: string = this.hubScopes()): void {
    this.cache.delete(scope);
  }

  private async fetchAndCache(scope: string): Promise<string> {
    const clientId = this.clientId();
    const clientSecret = this.clientSecret();
    const tokenUrl = this.tokenUrl();

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      scope,
    });

    let res: Response;
    try {
      res = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[M2M] token fetch network error scopes=${scope}: ${message}`,
      );
      throw new ServiceUnavailableException(
        `Unable to obtain M2M token for ${scope}`,
      );
    }

    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!res.ok || !json.access_token) {
      this.logger.warn(
        `[M2M] token fetch failed scopes=${scope} status=${res.status} error=${json.error || ''} ${json.error_description || ''}`,
      );
      throw new UnauthorizedException(
        `M2M token request for ${scope} was rejected`,
      );
    }

    const expiresInSec =
      typeof json.expires_in === 'number' && json.expires_in > 120
        ? json.expires_in
        : 3600;
    // Refresh 60s before expiry (floor at 30s lifetime).
    const refreshAtMs = Date.now() + Math.max(expiresInSec - 60, 30) * 1000;

    this.cache.set(scope, { accessToken: json.access_token, refreshAtMs });
    this.logger.log(
      `[M2M] Platform token successfully loaded clientId=${clientId} scopes=${scope} expiresIn=${expiresInSec}s`,
    );
    return json.access_token;
  }

  private clientId(): string {
    return this.config.get<string>('cognito.m2mPlatformClientId')?.trim() || '';
  }

  private clientSecret(): string {
    return (
      this.config.get<string>('cognito.m2mPlatformClientSecret')?.trim() || ''
    );
  }

  private tokenUrl(): string {
    const explicit = this.config.get<string>('cognito.m2mTokenUrl')?.trim();
    if (explicit) return explicit;
    const hosted = this.config.get<string>('cognito.hostedUiBaseUrl')?.trim();
    if (hosted) return `${hosted.replace(/\/$/, '')}/oauth2/token`;
    return '';
  }

  private hubScopes(): string {
    return (
      this.config.get<string>('cognito.m2mHubScopes')?.trim() ||
      'hub/catalog.read hub/admin.read hub/admin.create hub/admin.update hub/admin.delete'
    );
  }
}
