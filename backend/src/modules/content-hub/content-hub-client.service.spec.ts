import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { ContentHubClientService } from './content-hub-client.service';
import type { CognitoM2mTokenService } from '../../auth/cognito-m2m-token.service';
import type { RedisCacheService } from '../../cache/redis-cache.service';
import type { HttpService } from '@nestjs/axios';

describe('ContentHubClientService request options', () => {
  const request = jest.fn().mockReturnValue(of({ data: { ok: true } }));
  const http = { request, get: jest.fn() } as unknown as HttpService;
  const cache = {
    getJson: jest.fn().mockResolvedValue(null),
    setJson: jest.fn(),
  } as unknown as RedisCacheService;
  const m2mTokens = {
    isConfigured: jest.fn().mockReturnValue(true),
    getAccessToken: jest.fn().mockResolvedValue('token'),
  } as unknown as CognitoM2mTokenService;
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'contenthub.baseUrl') return 'https://hub.example/api/public';
      if (key === 'contenthub.adminBaseUrl')
        return 'https://hub.example/api/admin';
      return '';
    }),
  } as unknown as ConfigService;

  const service = new ContentHubClientService(
    config,
    http,
    cache,
    m2mTokens,
  );

  beforeEach(() => jest.clearAllMocks());

  it('postAdmin forwards query params and timeout', async () => {
    await service.postAdmin('/campaigns/42/export-ingest', undefined, {
      timeoutMs: 55_000,
      params: {
        source: 'http',
        exportCampaignId: '42',
        trigger: 'platform_generate',
      },
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'https://hub.example/api/admin/campaigns/42/export-ingest?source=http&exportCampaignId=42&trigger=platform_generate',
        timeout: 55_000,
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      }),
    );
  });

  it('throws when admin base URL is missing', async () => {
    const bare = new ContentHubClientService(
      {
        get: () => '',
      } as unknown as ConfigService,
      http,
      cache,
      m2mTokens,
    );
    await expect(bare.postAdmin('/campaigns/1/export-ingest')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('maps upstream failures through logError path', async () => {
    request.mockReturnValueOnce(
      throwError(() => ({
        isAxiosError: true,
        response: { status: 503, data: { message: 'down' } },
        message: 'down',
      })),
    );
    await expect(service.postAdmin('/campaigns/1/x')).rejects.toBeTruthy();
  });
});
