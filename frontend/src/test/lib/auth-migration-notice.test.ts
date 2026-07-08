import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  AUTH_MIGRATION_NOTICE_END_ISO,
  showAuthMigrationNotice,
} from '../../lib/auth-migration-notice';

vi.mock('../../lib/auth-config', () => ({
  cognitoAuthEnabled: true,
}));

describe('showAuthMigrationNotice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false after the notice end date', () => {
    const endMs = Date.parse(AUTH_MIGRATION_NOTICE_END_ISO);
    expect(showAuthMigrationNotice(endMs + 1)).toBe(false);
  });

  it('is true before the notice end date', () => {
    const endMs = Date.parse(AUTH_MIGRATION_NOTICE_END_ISO);
    expect(showAuthMigrationNotice(endMs - 60_000)).toBe(true);
  });
});
