/**
 * Bridge Cognito MFA challenges from Join (post-email-verify auto-login)
 * onto the Login page without losing the challenge session.
 */
const PENDING_LOGIN_MFA_KEY = 'cht-pending-login-mfa';

export type PendingLoginMfa = {
  email: string;
  mfa?: {
    session: string;
    challenge: 'SOFTWARE_TOKEN_MFA' | 'SMS_MFA';
  };
  mfaSetup?: {
    session: string;
    secretCode: string;
    otpauthUri: string;
  };
};

export function stashPendingLoginMfa(payload: PendingLoginMfa): void {
  try {
    sessionStorage.setItem(PENDING_LOGIN_MFA_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function consumePendingLoginMfa(): PendingLoginMfa | null {
  try {
    const raw = sessionStorage.getItem(PENDING_LOGIN_MFA_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_LOGIN_MFA_KEY);
    const parsed = JSON.parse(raw) as PendingLoginMfa;
    if (!parsed?.email || typeof parsed.email !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
