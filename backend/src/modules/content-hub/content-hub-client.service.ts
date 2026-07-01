import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { RedisCacheService } from '../../cache/redis-cache.service';
import { cacheKeyHash } from '../../cache/cache-key.util';
import { axiosContentHubErrorMeta } from '../../utils/content-hub-error';
import { newContentHubRequestId } from '../../utils/request-id';

/**
 * Server-to-server client for Content Hub public producer API (KOL network).
 * Spec: KOL_Network_API_Spec.pdf — GET /kols*, auth via X-API-Key, X-Request-Id UUID per call.
 */
@Injectable()
export class ContentHubClientService {
  private readonly logger = new Logger(ContentHubClientService.name);
  private readonly baseUrl: string;
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
    this.apiKey = this.config.get<string>('contenthub.apiKey')?.trim() || null;

    if (!this.apiKey && this.baseUrl) {
      this.logger.warn(
        'CONTENTHUB_API_KEY not configured — Content Hub calls disabled',
      );
    }
  }

  isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey);
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

  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const cleanParams = params
      ? (Object.fromEntries(
          Object.entries(params).filter(
            ([, v]) => v !== undefined && v !== '',
          ),
        ) as Record<string, string | number | boolean>)
      : undefined;

    const cacheKey = `cht:contenthub:${path}:${cacheKeyHash(cleanParams ?? {})}`;
    const cached = await this.cache.getJson<T>(cacheKey);
    if (cached != null) return cached;

    const url = `${this.baseUrl}${path}`;
    const requestId = newContentHubRequestId();

    try {
      const { data } = await firstValueFrom(
        this.http.get<T>(url, {
          headers: this.buildHeaders(requestId),
          params: cleanParams,
        }),
      );
      if (data != null) {
        await this.cache.setJson(cacheKey, data);
      }
      return data;
    } catch (err: unknown) {
      const meta = isAxiosError(err)
        ? axiosContentHubErrorMeta(err)
        : { status: 500, message: 'Unknown error' };
      this.logger.warn(
        `Content Hub GET ${path} failed (status=${meta.status}, x-request-id=${requestId}` +
          `${meta.requestId ? `, upstream=${meta.requestId}` : ''}): ${meta.message}`,
      );
      throw err;
    }
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const requestId = newContentHubRequestId();

    try {
      const { data } = await firstValueFrom(
        this.http.post<T>(url, body, {
          headers: this.buildHeaders(requestId),
        }),
      );
      return data;
    } catch (err: unknown) {
      const meta = isAxiosError(err)
        ? axiosContentHubErrorMeta(err)
        : { status: 500, message: 'Unknown error' };
      this.logger.warn(
        `Content Hub POST ${path} failed (status=${meta.status}, x-request-id=${requestId}` +
          `${meta.requestId ? `, upstream=${meta.requestId}` : ''}): ${meta.message}`,
      );
      throw err;
    }
  }
}
