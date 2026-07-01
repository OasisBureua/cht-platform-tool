import { cognitoAuthEnabled } from './auth-config';

/**
 * Temporary Cognito migration copy on login / password-reset pages.
 * Update NOTICE_END_ISO when deploying; delete this module after it expires.
 */
export const AUTH_MIGRATION_NOTICE_END_ISO = '2026-07-13T23:59:59.000Z';

export function showAuthMigrationNotice(nowMs: number = Date.now()): boolean {
  if (!cognitoAuthEnabled) return false;
  const endMs = Date.parse(AUTH_MIGRATION_NOTICE_END_ISO);
  if (Number.isNaN(endMs)) return false;
  return nowMs < endMs;
}
