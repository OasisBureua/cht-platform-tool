import { BadRequestException } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { AuthController } from './auth.controller';
import {
  CURRENT_BETA_TERMS_VERSION,
  CURRENT_TERMS_VERSION,
  hasAcceptedCurrentTerms,
  hasAcceptedRequiredConsent,
} from '../common/terms';

describe('AuthController terms acceptance', () => {
  const user = {
    userId: 'user-1',
    authId: 'auth-1',
    email: 'hcp@example.com',
    name: 'Test HCP',
    role: 'HCP',
  } as never;

  const authService = {
    acceptTerms: jest.fn(),
    revokeSession: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { record: jest.fn() };
  const featureFlags = {
    isMfaEnrollmentEnabled: jest.fn().mockReturnValue(false),
    getAuthFeatures: jest.fn().mockReturnValue({
      mfa: { enabled: false, method: 'sms' },
      betaTerms: { required: true },
    }),
    isBetaTermsRequired: jest.fn().mockReturnValue(true),
  };

  const req = {
    ip: '10.0.0.1',
    headers: {
      'user-agent': 'jest',
      cookie: 'cht_session=5b0c6d0e-3f4a-4b8e-9c1d-2a7e6f8b9c01',
    },
    cookies: { cht_session: '5b0c6d0e-3f4a-4b8e-9c1d-2a7e6f8b9c01' },
  } as never;

  const clearCookie = jest.fn();
  const res = {
    cookie: jest.fn(),
    clearCookie,
  } as unknown as ExpressResponse;

  const buildController = () =>
    new AuthController(
      authService as never,
      { isConfigured: jest.fn().mockReturnValue(true) } as never,
      {} as never,
      {} as never,
      {} as never,
      { get: jest.fn().mockReturnValue(undefined) } as never,
      audit as never,
      featureFlags as never,
    );

  beforeEach(() => jest.clearAllMocks());

  it('saves ToS + beta acceptance for the current versions and audits it', async () => {
    const acceptedAt = new Date('2026-09-29T12:00:00.000Z');
    authService.acceptTerms.mockResolvedValue({
      termsAcceptedAt: acceptedAt,
      termsVersion: CURRENT_TERMS_VERSION,
      betaTermsAcceptedAt: acceptedAt,
      betaTermsVersion: CURRENT_BETA_TERMS_VERSION,
    });

    const result = await buildController().acceptTerms(
      user,
      CURRENT_TERMS_VERSION,
      true,
      CURRENT_BETA_TERMS_VERSION,
      req,
    );

    expect(authService.acceptTerms).toHaveBeenCalledWith(
      'user-1',
      CURRENT_TERMS_VERSION,
      expect.objectContaining({ acceptBetaTerms: true }),
    );
    expect(result).toEqual({
      termsAccepted: true,
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: acceptedAt.toISOString(),
      betaTermsAccepted: true,
      betaTermsVersion: CURRENT_BETA_TERMS_VERSION,
      betaTermsAcceptedAt: acceptedAt.toISOString(),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.terms_accepted',
        actorId: 'user-1',
        metadata: expect.objectContaining({
          termsVersion: CURRENT_TERMS_VERSION,
          betaTermsVersion: CURRENT_BETA_TERMS_VERSION,
        }),
      }),
    );
  });

  it('rejects accept without beta checkbox when beta is required', async () => {
    await expect(
      buildController().acceptTerms(
        user,
        CURRENT_TERMS_VERSION,
        false,
        CURRENT_BETA_TERMS_VERSION,
        req,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(authService.acceptTerms).not.toHaveBeenCalled();
  });

  it('rejects a stale terms version without saving', async () => {
    await expect(
      buildController().acceptTerms(
        user,
        '2020-01-01',
        true,
        CURRENT_BETA_TERMS_VERSION,
        req,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(authService.acceptTerms).not.toHaveBeenCalled();
  });

  it('audits a decline, revokes the session and clears the cookie', async () => {
    const result = await buildController().declineTerms(user, req, res);

    expect(result).toEqual({ ok: true });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.terms_declined',
        actorId: 'user-1',
      }),
    );
    expect(authService.revokeSession).toHaveBeenCalledWith(
      '5b0c6d0e-3f4a-4b8e-9c1d-2a7e6f8b9c01',
    );
    expect(clearCookie).toHaveBeenCalled();
  });

  it('treats missing or outdated acceptance as not accepted', () => {
    expect(hasAcceptedCurrentTerms(null)).toBe(false);
    expect(
      hasAcceptedCurrentTerms({
        termsAcceptedAt: null,
        termsVersion: CURRENT_TERMS_VERSION,
      }),
    ).toBe(false);
    expect(
      hasAcceptedCurrentTerms({
        termsAcceptedAt: new Date(),
        termsVersion: 'old',
      }),
    ).toBe(false);
    expect(
      hasAcceptedCurrentTerms({
        termsAcceptedAt: new Date(),
        termsVersion: CURRENT_TERMS_VERSION,
      }),
    ).toBe(true);
  });

  it('requires beta terms when the gate is on', () => {
    const withTermsOnly = {
      termsAcceptedAt: new Date(),
      termsVersion: CURRENT_TERMS_VERSION,
      betaTermsAcceptedAt: null,
      betaTermsVersion: null,
    };
    expect(hasAcceptedRequiredConsent(withTermsOnly, true)).toBe(false);
    expect(hasAcceptedRequiredConsent(withTermsOnly, false)).toBe(true);
    expect(
      hasAcceptedRequiredConsent(
        {
          ...withTermsOnly,
          betaTermsAcceptedAt: new Date(),
          betaTermsVersion: CURRENT_BETA_TERMS_VERSION,
        },
        true,
      ),
    ).toBe(true);
  });
});
