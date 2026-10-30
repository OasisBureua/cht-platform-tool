import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AdminCapabilityGuard } from './admin-capability.guard';
import { ADMIN_CAPABILITY_KEY } from './admin-capability.decorator';
import type { AuthUser } from './auth.service';

function makeContext(user: AuthUser | undefined, capability: string | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === ADMIN_CAPABILITY_KEY ? capability : undefined,
    ),
  } as unknown as Reflector;
  const guard = new AdminCapabilityGuard(reflector);
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        method: 'POST',
        url: '/api/payments/x/pay-now',
        originalUrl: '/api/payments/x/pay-now',
      }),
    }),
  };
  return { guard, ctx };
}

function user(partial: Partial<AuthUser>): AuthUser {
  const u = {
    authId: 'a',
    userId: 'u1',
    email: 'a@example.com',
    name: 'A',
    role: UserRole.ADMIN,
    capabilities: [],
    ...partial,
  } as AuthUser;
  return u;
}

describe('AdminCapabilityGuard', () => {
  it('allows when no capability metadata is set', () => {
    const { guard, ctx } = makeContext(user({}), undefined);
    expect(guard.canActivate(ctx as never)).toBe(true);
  });

  it('allows SUPER_ADMIN without capabilities', () => {
    const { guard, ctx } = makeContext(
      user({ role: UserRole.SUPER_ADMIN, capabilities: [] }),
      'payments',
    );
    expect(guard.canActivate(ctx as never)).toBe(true);
  });

  it('allows ADMIN with the required capability', () => {
    const { guard, ctx } = makeContext(
      user({ capabilities: ['payments'] }),
      'payments',
    );
    expect(guard.canActivate(ctx as never)).toBe(true);
  });

  it('denies ADMIN missing the capability', () => {
    const { guard, ctx } = makeContext(
      user({ capabilities: ['programs'] }),
      'payments',
    );
    expect(() => guard.canActivate(ctx as never)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx as never)).toThrow(/Missing capability: payments/);
  });
});
