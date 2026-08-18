import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { RedisCacheService } from '../../cache/redis-cache.service';
import { CACHE_NAMESPACE } from '../../cache/cache-keys';
import { cacheKeyHash } from '../../cache/cache-key.util';
import { axiosContentHubErrorMeta } from '../../utils/content-hub-error';
import { newContentHubRequestId } from '../../utils/request-id';

export type ContentHubGetOptions = {
  cache?: boolean;
};

/**
 * Server-to-server client for Content Hub public producer API (KOL network)
 * and admin campaign API (/api/admin/*).
 */
@Injectable()
export class ContentHubClientService {
  private readonly logger = new Logger(ContentHubClientService.name);
  private readonly baseUrl: string;
  private readonly adminBaseUrl: string;
  private readonly apiKey: string | null;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly cache: RedisCacheService,
  ) {
    this.baseUrl = (this.config.get<string>('contenthub.baseUrl') || '').replace(
      /\/$/,
      '',
    );
    this.adminBaseUrl = (
      this.config.get<string>('contenthub.adminBaseUrl') || ''
    ).replace(/\/$/, '');
    this.apiKey = this.config.get<string>('contenthub.apiKey')?.trim() || null;

    if (!this.apiKey && (this.baseUrl || this.adminBaseUrl)) {
      this.logger.warn(
        'CONTENTHUB_API_KEY not configured, Content Hub calls disabled',
      );
    } else if (this.adminBaseUrl) {
      this.logger.log(`Content Hub admin API: ${this.adminBaseUrl}`);
    }
  }

  isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey);
  }

  isAdminConfigured(): boolean {
    return !!(this.adminBaseUrl && this.apiKey);
  }

  getAdminBaseUrl(): string {
    return this.adminBaseUrl;
  }

  private buildHeaders(requestId: string): Record<string, string> {
    if (!this.apiKey) {
      throw new Error('Content Hub API key not configured');
    }
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
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
    return this.getOnBase<T>(this.adminBaseUrl, path, params, {
      cache: options?.cache ?? true,
      admin: true,
    });
  }

  private async getOnBase<T>(
    base: string,
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: ContentHubGetOptions & { admin?: boolean },
  ): Promise<T> {
    const cleanParams = params
      ? (Object.fromEntries(
          Object.entries(params).filter(
            ([, v]) => v !== undefined && v !== '',
          ),
        ) as Record<string, string | number | boolean>)
      : undefined;

    const cacheEnabled = options?.cache !== false;
    const cachePrefix = options?.admin ? 'admin' : 'public';
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
          headers: this.buildHeaders(requestId),
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
    const url = `${base}${path}`;
    const requestId = newContentHubRequestId();

    try {
      const { data } = await firstValueFrom(
        this.http.request<T>({
          method,
          url,
          headers: this.buildHeaders(requestId),
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
