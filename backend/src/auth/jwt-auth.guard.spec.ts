import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard dev bypass', () => {
  const authService = {
    getSession: jest.fn(),
    resolveSession: jest.fn().mockResolvedValue(null),
    findByUserId: jest.fn(),
  };
  const configService = {
    get: jest.fn().mockReturnValue(undefined),
  };
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    authService.resolveSession.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('rejects X-Dev-User-Id in production when JWT is not configured', async () => {
    process.env.NODE_ENV = 'production';
    const guard = new JwtAuthGuard(
      configService as never,
      authService as never,
    );
    const request = {
      headers: { 'x-dev-user-id': 'user-1' },
      cookies: {},
    };
    const response = { cookie: jest.fn() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
