import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheClearService } from './cache-clear.service';
import { RedisCacheService } from './redis-cache.service';

describe('CacheClearService', () => {
  const cache = {
    isEnabled: jest.fn(),
    deleteByPattern: jest.fn(),
  } as unknown as RedisCacheService;

  const config = {
    get: jest.fn((key: string) =>
      key === 'internalCache.secret' ? 'test-secret' : undefined,
    ),
  } as unknown as ConfigService;

  let service: CacheClearService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CacheClearService(config, cache);
  });

  it('rejects when cache key is missing', () => {
    expect(() => service.assertCacheClearAuth({})).toThrow(BadRequestException);
  });

  it('accepts cacheKey query parameter', () => {
    expect(() =>
      service.assertCacheClearAuth({ cacheKey: 'test-secret' }),
    ).not.toThrow();
  });

  it('accepts bearer token matching configured secret', () => {
    expect(() =>
      service.assertCacheClearAuth({
        authorization: 'Bearer test-secret',
      }),
    ).not.toThrow();
  });

  it('rejects invalid cache key', () => {
    expect(() =>
      service.assertCacheClearAuth({ cacheKey: 'wrong' }),
    ).toThrow(UnauthorizedException);
  });

  it('clears only contenthub namespace patterns', async () => {
    (cache.isEnabled as jest.Mock).mockReturnValue(true);
    (cache.deleteByPattern as jest.Mock).mockImplementation(async (pattern: string) =>
      pattern.startsWith('cht:contenthub:') ? 3 : 0,
    );

    const result = await service.clear('contenthub', { authMethod: 'query' });
    expect(result.total).toBe(3);
    expect(result.deletedByPattern['cht:contenthub:*']).toBe(3);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(cache.deleteByPattern).toHaveBeenCalledWith('cht:contenthub:*');
    expect(cache.deleteByPattern).toHaveBeenCalledWith('cht:kol-network:*');
    expect(cache.deleteByPattern).not.toHaveBeenCalledWith('cht:catalog:*');
  });

  it('clears all namespace patterns for scope=all', async () => {
    (cache.isEnabled as jest.Mock).mockReturnValue(true);
    (cache.deleteByPattern as jest.Mock).mockResolvedValue(1);

    const result = await service.clear('all');
    expect(result.total).toBe(3);
    expect(cache.deleteByPattern).toHaveBeenCalledWith('cht:catalog:*');
    expect(cache.deleteByPattern).toHaveBeenCalledWith('cht:contenthub:*');
    expect(cache.deleteByPattern).toHaveBeenCalledWith('cht:kol-network:*');
  });
});
