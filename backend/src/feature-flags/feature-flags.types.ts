export type MfaMethod = 'sms' | 'totp';

export interface MfaFeatureFlags {
  enabled: boolean;
  method: MfaMethod;
}

export interface AuthFeatureFlags {
  mfa: MfaFeatureFlags;
}

export const DEFAULT_AUTH_FEATURE_FLAGS: AuthFeatureFlags = {
  mfa: {
    enabled: false,
    method: 'sms',
  },
};

export interface AuthFeaturesConfigDocument {
  mfa?: {
    enabled?: unknown;
    method?: unknown;
  };
}

export function parseAuthFeaturesConfig(
  raw: unknown,
): AuthFeatureFlags {
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

  return {
    mfa: {
      enabled,
      method,
    },
  };
}
