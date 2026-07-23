import { AuthLockoutService } from './auth-lockout.service';
import type { RedisCacheService } from '../cache/redis-cache.service';

describe('AuthLockoutService', () => {
  const cache = {
    getJson: jest.fn().mockResolvedValue(null),
    setJson: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  } as unknown as RedisCacheService;

  let service: AuthLockoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    (cache.getJson as jest.Mock).mockResolvedValue(null);
    service = new AuthLockoutService(cache);
  });

  it('allows requests before the failure threshold', async () => {
    expect(await service.assertAllowed('login', 'a@b.com', '1.1.1.1')).toEqual({
      locked: false,
    });
    for (let i = 0; i < 4; i++) {
      const result = await service.recordFailure('login', 'a@b.com', '1.1.1.1');
      expect(result.locked).toBe(false);
    }
  });

  it('locks after 5 login failures and clears on success', async () => {
    for (let i = 0; i < 4; i++) {
      await service.recordFailure('login', 'a@b.com', '1.1.1.1');
    }
    const locked = await service.recordFailure('login', 'a@b.com', '1.1.1.1');
    expect(locked.locked).toBe(true);
    expect(locked.message).toMatch(/Too many attempts/);

    const check = await service.assertAllowed('login', 'a@b.com', '1.1.1.1');
    expect(check.locked).toBe(true);

    await service.recordSuccess('login', 'a@b.com', '1.1.1.1');
    expect(await service.assertAllowed('login', 'a@b.com', '1.1.1.1')).toEqual({
      locked: false,
    });
  });

  it('uses a lower MFA threshold path (locks at 5 code failures)', async () => {
    for (let i = 0; i < 4; i++) {
      await service.recordFailure('mfa', 'a@b.com', '1.1.1.1');
    }
    const locked = await service.recordFailure('mfa', 'a@b.com', '1.1.1.1');
    expect(locked.locked).toBe(true);
  });

  it('scopes lockout by email + ip', async () => {
    for (let i = 0; i < 5; i++) {
      await service.recordFailure('login', 'a@b.com', '1.1.1.1');
    }
    expect(
      (await service.assertAllowed('login', 'a@b.com', '1.1.1.1')).locked,
    ).toBe(true);
    expect(
      (await service.assertAllowed('login', 'a@b.com', '2.2.2.2')).locked,
    ).toBe(false);
    expect(
      (await service.assertAllowed('login', 'other@b.com', '1.1.1.1')).locked,
    ).toBe(false);
  });
});
