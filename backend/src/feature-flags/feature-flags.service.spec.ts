import {
  DEFAULT_AUTH_FEATURE_FLAGS,
  parseAuthFeaturesConfig,
} from './feature-flags.types';

describe('parseAuthFeaturesConfig', () => {
  it('defaults MFA to disabled with sms method and beta terms required', () => {
    expect(parseAuthFeaturesConfig(undefined)).toEqual(
      DEFAULT_AUTH_FEATURE_FLAGS,
    );
    expect(parseAuthFeaturesConfig({})).toEqual(DEFAULT_AUTH_FEATURE_FLAGS);
    expect(parseAuthFeaturesConfig({ mfa: { enabled: false } })).toEqual(
      DEFAULT_AUTH_FEATURE_FLAGS,
    );
  });

  it('parses enabled MFA and method', () => {
    expect(
      parseAuthFeaturesConfig({
        mfa: { enabled: true, method: 'totp' },
      }),
    ).toEqual({
      mfa: { enabled: true, method: 'totp' },
      betaTerms: { required: true },
    });
  });

  it('falls back to sms for unknown methods', () => {
    expect(
      parseAuthFeaturesConfig({
        mfa: { enabled: true, method: 'webauthn' },
      }),
    ).toEqual({
      mfa: { enabled: true, method: 'sms' },
      betaTerms: { required: true },
    });
  });

  it('turns beta terms off when AppConfig sets required false', () => {
    expect(
      parseAuthFeaturesConfig({
        betaTerms: { required: false },
      }),
    ).toEqual({
      mfa: { enabled: false, method: 'sms' },
      betaTerms: { required: false },
    });
  });
});
