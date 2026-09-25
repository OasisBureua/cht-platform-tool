import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoM2mTokenService } from './cognito-m2m-token.service';

describe('CognitoM2mTokenService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  function buildService(overrides: Record<string, string> = {}) {
    const map: Record<string, string> = {
      'cognito.m2mPlatformClientId': 'platform-client',
      'cognito.m2mPlatformClientSecret': 'platform-secret',
      'cognito.m2mTokenUrl':
        'https://chm-dev.auth.us-east-1.amazoncognito.com/oauth2/token',
      'cognito.m2mHubScopes':
        'hub/catalog.read hub/admin.read hub/admin.create hub/admin.update hub/admin.delete',
      ...overrides,
    };
    const config = {
      get: (key: string) => map[key],
    } as unknown as ConfigService;
    return new CognitoM2mTokenService(config);
  }

  it('isConfigured is false without credentials', () => {
    const service = buildService({
      'cognito.m2mPlatformClientId': '',
      'cognito.m2mPlatformClientSecret': '',
    });
    expect(service.isConfigured()).toBe(false);
  });

  it('getAccessToken throws Unauthorized when not configured', async () => {
    const service = buildService({
      'cognito.m2mPlatformClientId': '',
    });
    await expect(service.getAccessToken()).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('fetches and caches a token; second call skips network', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'tok-1',
        expires_in: 3600,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = buildService();
    await expect(service.getAccessToken()).resolves.toBe('tok-1');
    await expect(service.getAccessToken()).resolves.toBe('tok-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/oauth2/token');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Basic /);
  });

  it('warms token onModuleInit when configured', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'warm', expires_in: 3600 }),
    }) as unknown as typeof fetch;

    const service = buildService();
    await service.onModuleInit();
    await expect(service.getAccessToken()).resolves.toBe('warm');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
