import type { Response as ExpressResponse } from 'express';
import { AuthController } from './auth.controller';
import { ServiceUnavailableException } from '@nestjs/common';

/**
 * SCRUM-101: /auth/login must fail-closed in production when Cognito is not
 * configured. The DB-fallback branch logs a user in by email with the password
 * IGNORED — never allow that outside local/test.
 */
describe('AuthController /login prod fail-closed (SCRUM-101)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  const configService = {
    get: jest.fn(() => undefined),
  };

  const authService = {
    findByEmail: jest.fn(),
    createSession: jest.fn(),
    getUserById: jest.fn(),
    isProfileComplete: jest.fn().mockReturnValue(true),
  };

  const cognitoService = {
    isConfigured: jest.fn().mockReturnValue(false),
  };

  const recaptchaService = {} as never;
  const lockout = {
    assertAllowed: jest.fn().mockResolvedValue({ locked: false }),
    recordFailure: jest.fn().mockResolvedValue({ locked: false }),
    recordSuccess: jest.fn().mockResolvedValue(undefined),
  };

  const audit = {
    record: jest.fn(),
  };

  const expressRes = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as ExpressResponse;

  const req = { ip: '127.0.0.1', headers: {} } as never;

  const featureFlags = {
    isMfaEnrollmentEnabled: jest.fn().mockReturnValue(false),
    getAuthFeatures: jest.fn().mockReturnValue({
      mfa: { enabled: false, method: 'sms' },
    }),
  };

  const buildController = () =>
    new AuthController(
      authService as never,
      cognitoService as never,
      recaptchaService,
      lockout as never,
      { lookup: jest.fn(), normalizeNpi: (v: string) => (v || '').replace(/\D/g, '').slice(0, 10) } as never,
      configService as never,
      audit as never,
      featureFlags as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    lockout.assertAllowed.mockResolvedValue({ locked: false });
    cognitoService.isConfigured.mockReturnValue(false);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('refuses the DB-fallback login in production without touching the DB', async () => {
    process.env.NODE_ENV = 'production';
    const controller = buildController();

    const result = await controller.login(
      'attacker@example.com',
      'anything',
      req,
      expressRes,
    );

    expect(result).toEqual({
      error: 'Login is not available. Please contact support.',
    });
    expect(authService.findByEmail).not.toHaveBeenCalled();
    expect(authService.createSession).not.toHaveBeenCalled();
    expect(expressRes.cookie).not.toHaveBeenCalled();
  });

  it('directs clients to Cognito when Cognito is configured', async () => {
    process.env.NODE_ENV = 'production';
    cognitoService.isConfigured.mockReturnValue(true);
    const controller = buildController();

    await expect(
      controller.login('user@example.com', 'anything', req, expressRes),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(authService.findByEmail).not.toHaveBeenCalled();
  });

  it('allows the DB-fallback login in non-production (dev/local)', async () => {
    process.env.NODE_ENV = 'development';
    authService.findByEmail.mockResolvedValue({
      userId: 'u-1',
      email: 'dev@example.com',
      name: 'Dev User',
      role: 'HCP',
    });
    authService.createSession.mockResolvedValue('session-token-dev');
    authService.getUserById.mockResolvedValue({
      userId: 'u-1',
      email: 'dev@example.com',
      firstName: 'Dev',
      lastName: 'User',
    });
    const controller = buildController();

    const result = await controller.login(
      'dev@example.com',
      'ignored-password',
      req,
      expressRes,
    );

    expect(authService.findByEmail).toHaveBeenCalledWith('dev@example.com');
    expect(authService.createSession).toHaveBeenCalled();
    expect(result).toMatchObject({
      session_token: 'session-token-dev',
      userId: 'u-1',
      email: 'dev@example.com',
    });
  });

  it('still validates input (bad email) before running the prod guard', async () => {
    process.env.NODE_ENV = 'production';
    const controller = buildController();

    const result = await controller.login('', 'anything', req, expressRes);
    expect(result).toEqual({ error: 'Email is required.' });
    expect(authService.findByEmail).not.toHaveBeenCalled();
  });

  it('blocks login when lockout is active', async () => {
    process.env.NODE_ENV = 'production';
    lockout.assertAllowed.mockResolvedValue({
      locked: true,
      message: 'Too many attempts. Please try again in 15 minute(s).',
    });
    const controller = buildController();

    const result = await controller.login(
      'attacker@example.com',
      'anything',
      req,
      expressRes,
    );

    expect(result).toEqual({
      error: 'Too many attempts. Please try again in 15 minute(s).',
    });
    expect(authService.findByEmail).not.toHaveBeenCalled();
  });
});
