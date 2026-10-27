export type MfaMethod = 'sms' | 'totp';

export interface MfaFeatureFlags {
  enabled: boolean;
  method: MfaMethod;
}

export interface BetaTermsFeatureFlags {
  /**
   * When true, authenticated users must accept CURRENT_BETA_TERMS_VERSION
   * before using the app. Turn off after the beta period (AppConfig or env).
   */
  required: boolean;
}

export interface AuthFeatureFlags {
  mfa: MfaFeatureFlags;
  betaTerms: BetaTermsFeatureFlags;
}

/**
 * Beta terms default ON so Session 2 ships without AppConfig.
 * Set AppConfig `{ "betaTerms": { "required": false } }` or env
 * `BETA_TERMS_REQUIRED=false` to hide the gate after beta.
 */
export const DEFAULT_AUTH_FEATURE_FLAGS: AuthFeatureFlags = {
  mfa: {
    enabled: false,
    method: 'sms',
  },
  betaTerms: {
    required: true,
  },
};

export interface AuthFeaturesConfigDocument {
  mfa?: {
    enabled?: unknown;
    method?: unknown;
  };
  betaTerms?: {
    required?: unknown;
  };
}

export function parseAuthFeaturesConfig(raw: unknown): AuthFeatureFlags {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_AUTH_FEATURE_FLAGS;
  }

  const doc = raw as AuthFeaturesConfigDocument;
  const enabled = doc.mfa?.enabled === true;
  const methodRaw =
    typeof doc.mfa?.method === 'string'
      ? doc.mfa.method.trim().toLowerCase()
      : DEFAULT_AUTH_FEATURE_FLAGS.mfa.method;
  const method: MfaMethod =
    methodRaw === 'totp' || methodRaw === 'sms'
      ? methodRaw
      : DEFAULT_AUTH_FEATURE_FLAGS.mfa.method;

  // Explicit false turns beta off; missing key keeps default (required).
  const betaRequired =
    doc.betaTerms?.required === false
      ? false
      : doc.betaTerms?.required === true
        ? true
        : DEFAULT_AUTH_FEATURE_FLAGS.betaTerms.required;

  return {
    mfa: {
      enabled,
      method,
    },
    betaTerms: {
      required: betaRequired,
    },
  };
}
