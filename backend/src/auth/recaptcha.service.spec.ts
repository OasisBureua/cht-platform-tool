import { ConfigService } from '@nestjs/config';
import { RecaptchaService } from './recaptcha.service';

describe('RecaptchaService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function service(secretKey = 'test-secret', minScore = 0.5) {
    const config = {
      get: (key: string) => {
        if (key === 'recaptcha.secretKey') return secretKey;
        if (key === 'recaptcha.minScore') return minScore;
        return undefined;
      },
    } as unknown as ConfigService;
    return new RecaptchaService(config);
  }

  it('skips verification when secret is not configured', async () => {
    const svc = service('');
    await expect(svc.verify(undefined, 'login')).resolves.toEqual({ ok: true });
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
});
