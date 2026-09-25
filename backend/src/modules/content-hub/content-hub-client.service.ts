import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { CognitoM2mTokenService } from '../../auth/cognito-m2m-token.service';
import { RedisCacheService } from '../../cache/redis-cache.service';
import { CACHE_NAMESPACE } from '../../cache/cache-keys';
import { cacheKeyHash } from '../../cache/cache-key.util';
import { axiosContentHubErrorMeta } from '../../utils/content-hub-error';
import { newContentHubRequestId } from '../../utils/request-id';

export type ContentHubGetOptions = {
  cache?: boolean;
};

/**
 * Server-to-server client for Content Hub public + admin APIs.
 * Auth: Cognito M2M Bearer only (no X-API-Key).
 */
@Injectable()
export class ContentHubClientService {
  private readonly logger = new Logger(ContentHubClientService.name);
  private readonly baseUrl: string;
  private readonly adminBaseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly cache: RedisCacheService,
    private readonly m2mTokens: CognitoM2mTokenService,
  ) {
    this.baseUrl = (this.config.get<string>('contenthub.baseUrl') || '').replace(
      /\/$/,
      '',
    );
    this.adminBaseUrl = (
      this.config.get<string>('contenthub.adminBaseUrl') || ''
    ).replace(/\/$/, '');

    if (!this.m2mTokens.isConfigured() && (this.baseUrl || this.adminBaseUrl)) {
      this.logger.warn(
        'Content Hub M2M not configured — Hub calls will 401 until COGNITO_M2M_PLATFORM_* is set',
      );
    } else if (this.adminBaseUrl) {
      this.logger.log(`Content Hub admin API: ${this.adminBaseUrl}`);
    }
  }

  isConfigured(): boolean {
    return !!(this.baseUrl && this.m2mTokens.isConfigured());
  }

  isAdminConfigured(): boolean {
    return !!(this.adminBaseUrl && this.m2mTokens.isConfigured());
  }

  getAdminBaseUrl(): string {
    return this.adminBaseUrl;
  }

  private async buildHeaders(
    requestId: string,
  ): Promise<Record<string, string>> {
    const accessToken = await this.m2mTokens.getAccessToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Request-Id': requestId,
    };
  }

  private logError(
    method: string,
    path: string,
    requestId: string,
    err: unknown,
  ): { status: number; message: string } {
    const meta = isAxiosError(err)
      ? axiosContentHubErrorMeta(err)
      : { status: 500, message: 'Unknown error' };
    this.logger.warn(
      `Content Hub ${method} ${path} failed (status=${meta.status}, x-request-id=${requestId}` +
        `${meta.requestId ? `, upstream=${meta.requestId}` : ''}): ${meta.message}`,
    );
    return meta;
  }

  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: ContentHubGetOptions,
  ): Promise<T> {
    return this.getOnBase<T>(this.baseUrl, path, params, options);
  }

  async getAdmin<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: ContentHubGetOptions,
  ): Promise<T> {
    return this.getOnBase<T>(this.adminBaseUrl, path, params, options);
  }

  private async getOnBase<T>(
    base: string,
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: ContentHubGetOptions,
  ): Promise<T> {
    if (!base) {
      throw new UnauthorizedException('Content Hub base URL is not configured');
    }

    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
        )
      : undefined;

    const cacheEnabled = options?.cache !== false;
    const cachePrefix = base === this.adminBaseUrl ? 'admin' : 'public';
    const cacheKey = `${CACHE_NAMESPACE.CONTENTHUB}:${cachePrefix}:${path}:${cacheKeyHash(cleanParams ?? {})}`;

    if (cacheEnabled) {
      const cached = await this.cache.getJson<T>(cacheKey);
      if (cached != null) return cached;
    }

    const url = `${base}${path}`;
    const requestId = newContentHubRequestId();

    try {
      const { data } = await firstValueFrom(
        this.http.get<T>(url, {
          headers: await this.buildHeaders(requestId),
          params: cleanParams,
        }),
      );
      if (cacheEnabled && data != null) {
        await this.cache.setJson(cacheKey, data);
      }
      return data;
    } catch (err: unknown) {
      this.logError('GET', path, requestId, err);
      throw err;
    }
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.requestOnBase<T>('POST', this.baseUrl, path, body);
  }

  async postAdmin<T>(path: string, body?: unknown): Promise<T> {
    return this.requestOnBase<T>('POST', this.adminBaseUrl, path, body);
  }

  async patchAdmin<T>(path: string, body: unknown): Promise<T> {
    return this.requestOnBase<T>('PATCH', this.adminBaseUrl, path, body);
  }

  async deleteAdmin(path: string): Promise<void> {
    await this.requestOnBase<void>('DELETE', this.adminBaseUrl, path);
  }

  private async requestOnBase<T>(
    method: 'POST' | 'PATCH' | 'DELETE',
    base: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!base) {
      throw new UnauthorizedException('Content Hub base URL is not configured');
    }
    const url = `${base}${path}`;
    const requestId = newContentHubRequestId();

    try {
      const { data } = await firstValueFrom(
        this.http.request<T>({
          method,
          url,
          headers: await this.buildHeaders(requestId),
          data: body,
        }),
      );
      return data as T;
    } catch (err: unknown) {
      this.logError(method, path, requestId, err);
      throw err;
    }
  }
}
