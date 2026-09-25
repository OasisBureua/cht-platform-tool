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
  scope: string;
};

/**
 * In-memory Cognito client_credentials cache for Platform → Hub.
 * Warms on boot so the first catalog/admin Hub call is not blocked on token POST.
 *
 * Logging policy: success and failure outcomes are OK to log.
 * Never log access_token, client_secret, or Authorization headers.
 */
@Injectable()
export class CognitoM2mTokenService implements OnModuleInit {
  private readonly logger = new Logger(CognitoM2mTokenService.name);
  private cache: CachedToken | null = null;
  private inflight: Promise<string> | null = null;

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
   * Bearer access token for Hub. Refreshes from cache ~60s before expiry.
   * Throws UnauthorizedException when M2M is not configured or mint fails.
   */
  async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new UnauthorizedException(
        'Content Hub M2M is not configured (missing platform outbound credentials)',
      );
    }

    const now = Date.now();
    if (this.cache && this.cache.refreshAtMs > now) {
      return this.cache.accessToken;
    }

    if (this.inflight) {
      return this.inflight;
    }

    this.inflight = this.fetchAndCache().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async fetchAndCache(): Promise<string> {
    const clientId = this.clientId();
    const clientSecret = this.clientSecret();
    const tokenUrl = this.tokenUrl();
    const scope = this.hubScopes();

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
      this.logger.warn(`[M2M] token fetch network error: ${message}`);
      throw new ServiceUnavailableException(
        'Unable to obtain Content Hub M2M token',
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
        `[M2M] token fetch failed status=${res.status} error=${json.error || ''} ${json.error_description || ''}`,
      );
      throw new UnauthorizedException(
        'Content Hub M2M token request was rejected',
      );
    }

    const expiresInSec =
      typeof json.expires_in === 'number' && json.expires_in > 120
        ? json.expires_in
        : 3600;
    // Refresh 60s before expiry (floor at 30s lifetime).
    const refreshAtMs = Date.now() + Math.max(expiresInSec - 60, 30) * 1000;

    this.cache = {
      accessToken: json.access_token,
      refreshAtMs,
      scope,
    };
    this.logger.log(
      `[M2M] Platform→Hub token successfully loaded clientId=${clientId} scopes=${scope} expiresIn=${expiresInSec}s`,
    );
    return json.access_token;
  }

  private clientId(): string {
    return (
      this.config.get<string>('cognito.m2mPlatformClientId')?.trim() || ''
    );
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
