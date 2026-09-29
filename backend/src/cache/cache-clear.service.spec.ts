import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { CacheClearService } from './cache-clear.service';
import { RedisCacheService } from './redis-cache.service';

describe('CacheClearService', () => {
  const isEnabled = jest.fn<boolean, []>();
  const deleteByPattern = jest.fn<Promise<number>, [string]>();
  const cache = {
    isEnabled,
    deleteByPattern,
  } as unknown as RedisCacheService;

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'internalCache.secret') return 'test-secret';
      if (key === 'cognito.m2mExportClientId') return 'hub-m2m-client';
      if (key === 'cognito.m2mCacheClearScope') return 'platform/cache.clear';
      return undefined;
    }),
  } as unknown as ConfigService;

  const cognito = {
    isConfigured: jest.fn().mockReturnValue(true),
    verifyM2mAccessToken: jest.fn(),
  };

  const moduleRef = {
    get: jest.fn().mockReturnValue(cognito),
  } as unknown as ModuleRef;

  let service: CacheClearService;

  beforeEach(() => {
    jest.clearAllMocks();
    cognito.isConfigured.mockReturnValue(true);
    (moduleRef.get as jest.Mock).mockReturnValue(cognito);
    service = new CacheClearService(config, cache, moduleRef);
  });

  it('rejects when cache key is missing', async () => {
    await expect(service.assertCacheClearAuth({})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts cacheKey query parameter', async () => {
    await expect(
      service.assertCacheClearAuth({ cacheKey: 'test-secret' }),
    ).resolves.toBe('query');
  });

  it('accepts bearer token matching configured secret', async () => {
    await expect(
      service.assertCacheClearAuth({
        authorization: 'Bearer test-secret',
      }),
    ).resolves.toBe('bearer');
  });

  it('rejects invalid cache key', async () => {
    await expect(
      service.assertCacheClearAuth({ cacheKey: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts Cognito M2M Bearer with platform/cache.clear', async () => {
    cognito.verifyM2mAccessToken.mockResolvedValue({
      client_id: 'hub-m2m-client',
      scope: 'platform/export.read platform/cache.clear',
    });
    // Three-segment JWT shape
    const jwt = 'aaa.bbb.ccc';
    await expect(
      service.assertCacheClearAuth({ authorization: `Bearer ${jwt}` }),
    ).resolves.toBe('m2m');
    expect(cognito.verifyM2mAccessToken).toHaveBeenCalledWith(jwt, {
      allowedClientIds: ['hub-m2m-client'],
      requiredScope: 'platform/cache.clear',
    });
  });

  it('rejects invalid M2M JWT without falling back to shared secret', async () => {
    cognito.verifyM2mAccessToken.mockRejectedValue(new Error('bad sig'));
    await expect(
      service.assertCacheClearAuth({
        authorization: 'Bearer aaa.bbb.ccc',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('clears only contenthub namespace patterns', async () => {
    isEnabled.mockReturnValue(true);
    deleteByPattern.mockImplementation((pattern: string) =>
      Promise.resolve(pattern.startsWith('cht:contenthub:') ? 3 : 0),
    );

    const result = await service.clear('contenthub', { authMethod: 'query' });
    expect(result.total).toBe(3);
    expect(result.deletedByPattern['cht:contenthub:*']).toBe(3);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(deleteByPattern).toHaveBeenCalledWith('cht:contenthub:*');
    expect(deleteByPattern).toHaveBeenCalledWith('cht:kol-network:*');
    expect(deleteByPattern).toHaveBeenCalledWith('cht:catalog:*');
  });

  it('clears all namespace patterns for scope=all', async () => {
    isEnabled.mockReturnValue(true);
    deleteByPattern.mockResolvedValue(1);

    const result = await service.clear('all');
    expect(result.total).toBe(3);
    expect(deleteByPattern).toHaveBeenCalledWith('cht:catalog:*');
    expect(deleteByPattern).toHaveBeenCalledWith('cht:contenthub:*');
    expect(deleteByPattern).toHaveBeenCalledWith('cht:kol-network:*');
  });
});
