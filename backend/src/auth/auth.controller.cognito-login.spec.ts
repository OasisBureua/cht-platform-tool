import type { Response as ExpressResponse } from 'express';
import { AuthController } from './auth.controller';
import {
  LOGIN_GENERIC_ERROR,
  LOGIN_UNVERIFIED_ERROR,
  CognitoUnhandledChallengeError,
} from './cognito-login-errors';

describe('AuthController Cognito password login (SCRUM-100)', () => {
  const cognitoService = {
    isConfigured: jest.fn().mockReturnValue(true),
    loginWithPassword: jest.fn(),
    buildOtpauthUri: jest.fn(
      (secret: string, email: string) =>
        `otpauth://totp/${email}?secret=${secret}`,
    ),
    completeMfaSetupChallenge: jest.fn(),
  };

  const recaptchaService = {
    verify: jest.fn().mockResolvedValue({ ok: true }),
  };

  const lockout = {
    assertAllowed: jest.fn().mockResolvedValue({ locked: false }),
    recordFailure: jest.fn().mockResolvedValue({ locked: false }),
    recordSuccess: jest.fn().mockResolvedValue(undefined),
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
      {
        findByEmail: jest.fn(),
        createSession: jest.fn(),
        getUserById: jest.fn(),
        isProfileComplete: jest.fn().mockReturnValue(true),
      } as never,
      cognitoService as never,
      recaptchaService as never,
      lockout as never,
      { lookup: jest.fn(), normalizeNpi: (v: string) => v } as never,
      { get: jest.fn().mockReturnValue(undefined) } as never,
      { record: jest.fn() } as never,
      featureFlags as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    cognitoService.isConfigured.mockReturnValue(true);
    recaptchaService.verify.mockResolvedValue({ ok: true });
    lockout.assertAllowed.mockResolvedValue({ locked: false });
    lockout.recordFailure.mockResolvedValue({ locked: false });
  });

  it('returns MFA_SETUP secret instead of a technical error', async () => {
    cognitoService.loginWithPassword.mockResolvedValue({
      kind: 'mfa_setup',
      session: 'setup-session',
      secretCode: 'SECRETBASE32',
    });
    const controller = buildController();

    const result = await controller.cognitoLogin(
      'user@example.com',
      'Password1!',
      undefined,
      req,
      expressRes,
    );

    expect(result).toEqual({
      challenge: 'MFA_SETUP',
      session: 'setup-session',
      secretCode: 'SECRETBASE32',
      otpauthUri: 'otpauth://totp/user@example.com?secret=SECRETBASE32',
    });
    expect(lockout.recordSuccess).toHaveBeenCalled();
    expect(lockout.recordFailure).not.toHaveBeenCalled();
  });

  it('keeps SOFTWARE_TOKEN_MFA challenge unchanged', async () => {
    cognitoService.loginWithPassword.mockResolvedValue({
      kind: 'mfa',
      challenge: 'SOFTWARE_TOKEN_MFA',
      session: 'totp-session',
    });
    const controller = buildController();

    await expect(
      controller.cognitoLogin(
        'user@example.com',
        'Password1!',
        undefined,
        req,
        expressRes,
      ),
    ).resolves.toEqual({
      challenge: 'SOFTWARE_TOKEN_MFA',
      session: 'totp-session',
    });
  });

  it('maps UserNotConfirmedException to verify-email copy', async () => {
    cognitoService.loginWithPassword.mockRejectedValue(
      Object.assign(new Error('User is not confirmed.'), {
        name: 'UserNotConfirmedException',
      }),
    );
    const controller = buildController();

    await expect(
      controller.cognitoLogin(
        'user@example.com',
        'Password1!',
        undefined,
        req,
        expressRes,
      ),
    ).resolves.toEqual({
      error: LOGIN_UNVERIFIED_ERROR,
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('does not leak unhandled challenge strings to the client', async () => {
    cognitoService.loginWithPassword.mockRejectedValue(
      new CognitoUnhandledChallengeError('SELECT_MFA_TYPE'),
    );
    const controller = buildController();

    const result = await controller.cognitoLogin(
      'user@example.com',
      'Password1!',
      undefined,
      req,
      expressRes,
    );

    expect(result).toEqual({
      error: LOGIN_GENERIC_ERROR,
      code: 'GENERIC',
    });
    expect(JSON.stringify(result)).not.toMatch(/SELECT_MFA_TYPE/);
    expect(JSON.stringify(result)).not.toMatch(/did not return tokens/);
  });
});
