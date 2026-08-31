import type { Response as ExpressResponse } from 'express';
import { AuthController } from './auth.controller';

/**
 * SCRUM-101: /auth/login must fail-closed when Supabase is not configured
 * in production. The DB-fallback branch below the Supabase call would
 * otherwise log a user in by email with the password IGNORED, a critical
 * vulnerability if SUPABASE_URL/SUPABASE_ANON_KEY drift out of the prod
 * secret in any deploy.
 */
describe('AuthController /login prod fail-closed (SCRUM-101)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  // ConfigService that reports Supabase as NOT configured. Reproduces the
  // real vulnerability window: prod env with missing SUPABASE_URL/ANON_KEY.
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'supabase.authDecommissioned') return true;
      if (key === 'supabase.url') return undefined;
      if (key === 'supabase.anonKey') return undefined;
      return undefined;
    }),
  };

  const authService = {
    findByEmail: jest.fn(),
    createSession: jest.fn(),
    getUserById: jest.fn(),
    isProfileComplete: jest.fn().mockReturnValue(true),
  };

  const cognitoService = {} as never;
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
      cognitoService,
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
    // Critical: no DB lookup, no session created, no cookie set.
    expect(authService.findByEmail).not.toHaveBeenCalled();
    expect(authService.createSession).not.toHaveBeenCalled();
    expect(expressRes.cookie).not.toHaveBeenCalled();
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
