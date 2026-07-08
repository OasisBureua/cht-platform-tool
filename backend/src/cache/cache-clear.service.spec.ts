import { UnauthorizedException } from '@nestjs/common';
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

  it('rejects missing internal secret', () => {
    expect(() => service.assertInternalSecret(undefined, undefined)).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts bearer token matching configured secret', () => {
    expect(() =>
      service.assertInternalSecret('Bearer test-secret', undefined),
    ).not.toThrow();
  });

  it('clears only contenthub namespace patterns', async () => {
    (cache.isEnabled as jest.Mock).mockReturnValue(true);
    (cache.deleteByPattern as jest.Mock).mockImplementation(async (pattern: string) =>
      pattern.startsWith('cht:contenthub:') ? 3 : 0,
    );

    const result = await service.clear('contenthub');
    expect(result.total).toBe(3);
    expect(result.deletedByPattern['cht:contenthub:*']).toBe(3);
    expect(cache.deleteByPattern).toHaveBeenCalledWith('cht:contenthub:*');
    expect(cache.deleteByPattern).toHaveBeenCalledWith('cht:kol-network:*');
    expect(cache.deleteByPattern).not.toHaveBeenCalledWith('cht:catalog:*');
  });
});
