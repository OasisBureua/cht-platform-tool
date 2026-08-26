import { ConfigService } from '@nestjs/config';
import { RecaptchaService } from './recaptcha.service';

describe('RecaptchaService', () => {
  const originalFetch = global.fetch;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  function service(
    secretKey = 'test-secret',
    minScore = 0.5,
    nodeEnv?: string,
  ) {
    const config = {
      get: (key: string) => {
        if (key === 'recaptcha.secretKey') return secretKey;
        if (key === 'recaptcha.minScore') return minScore;
        if (key === 'nodeEnv') return nodeEnv;
        return undefined;
      },
    } as unknown as ConfigService;
    return new RecaptchaService(config);
  }

  it('skips verification when secret is not configured outside production', async () => {
    process.env.NODE_ENV = 'development';
    const svc = service('', 0.5, 'development');
    await expect(svc.verify(undefined, 'login')).resolves.toEqual({ ok: true });
  });

  it('blocks when secret is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    const svc = service('', 0.5, 'production');
    await expect(svc.verify('any-token', 'login')).resolves.toEqual({
      error: 'Captcha is not configured. Please contact support.',
    });
    await expect(svc.verify(undefined, 'signup')).resolves.toEqual({
      error: 'Captcha is not configured. Please contact support.',
    });
  });

  it('requires token when enabled', async () => {
    const svc = service();
    await expect(svc.verify('', 'login')).resolves.toEqual({
      error: 'Captcha verification is required.',
    });
  });

  it('accepts valid siteverify response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, score: 0.9, action: 'login' }),
    }) as unknown as typeof fetch;

    const svc = service();
    await expect(svc.verify('token', 'login')).resolves.toEqual({ ok: true });
  });

  it('rejects low score', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, score: 0.1, action: 'signup' }),
    }) as unknown as typeof fetch;

    const svc = service('secret', 0.5);
    await expect(svc.verify('token', 'signup')).resolves.toEqual({
      error: 'Captcha verification failed. Please try again.',
    });
  });

  it('still verifies normally in production when secret is configured', async () => {
    process.env.NODE_ENV = 'production';
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, score: 0.9, action: 'login' }),
    }) as unknown as typeof fetch;

    const svc = service('prod-secret', 0.5, 'production');
    await expect(svc.verify('token', 'login')).resolves.toEqual({ ok: true });
  });
});
