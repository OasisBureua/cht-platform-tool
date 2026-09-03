import { describe, it, expect, vi, afterEach } from 'vitest';
import { isTestappHost, resolveApiBaseUrl, resolveAppBaseUrl } from '../../config/app-urls';

describe('app-urls', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses VITE_API_URL when set at build time', () => {
    vi.stubEnv('VITE_API_URL', 'https://staging.testapp.communityhealth.media/api');
    expect(resolveApiBaseUrl()).toBe('https://staging.testapp.communityhealth.media/api');
  });

  it('falls back to same-origin /api on staging host when env unset', () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubGlobal('window', {
      location: {
        origin: 'https://staging.testapp.communityhealth.media',
        hostname: 'staging.testapp.communityhealth.media',
      },
    } as Window & typeof globalThis);
    expect(resolveApiBaseUrl()).toBe('https://staging.testapp.communityhealth.media/api');
  });

  it('falls back to same-origin /api on platform host when env unset', () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubGlobal('window', {
      location: {
        origin: 'https://testapp.communityhealth.media',
        hostname: 'testapp.communityhealth.media',
      },
    } as Window & typeof globalThis);
    expect(resolveApiBaseUrl()).toBe('https://testapp.communityhealth.media/api');
  });

  it('uses VITE_APP_URL for OAuth when set', () => {
    vi.stubEnv('VITE_APP_URL', 'https://staging.testapp.communityhealth.media');
    expect(resolveAppBaseUrl()).toBe('https://staging.testapp.communityhealth.media');
  });

  it('treats testapp and staging.testapp as platform hosts', () => {
    expect(isTestappHost('testapp.communityhealth.media')).toBe(true);
    expect(isTestappHost('staging.testapp.communityhealth.media')).toBe(true);
    expect(isTestappHost('devapp.communityhealth.media')).toBe(false);
  });

  it('does not map staging host to platform OAuth URL', () => {
    vi.stubEnv('VITE_APP_URL', '');
    vi.stubGlobal('window', {
      location: {
        origin: 'https://staging.testapp.communityhealth.media',
        hostname: 'staging.testapp.communityhealth.media',
      },
    } as Window & typeof globalThis);
    expect(resolveAppBaseUrl()).toBe('https://staging.testapp.communityhealth.media');
  });
});
