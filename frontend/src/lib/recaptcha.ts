const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (key: string, options: { action: string }) => Promise<string>;
    };
  }
}

export type RecaptchaAction = 'login' | 'signup';

export function recaptchaConfigured(): boolean {
  return !!siteKey;
}

let scriptLoadPromise: Promise<void> | null = null;

function loadRecaptchaScript(): Promise<void> {
  if (!siteKey) {
    return Promise.reject(new Error('reCAPTCHA is not configured.'));
  }
  if (window.grecaptcha) {
    return Promise.resolve();
  }
  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-cht-recaptcha="v3"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load reCAPTCHA.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.chtRecaptcha = 'v3';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA.'));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export async function executeRecaptcha(action: RecaptchaAction): Promise<string> {
  if (!siteKey) {
    throw new Error('reCAPTCHA is not configured.');
  }

  await loadRecaptchaScript();

  return new Promise((resolve, reject) => {
    window.grecaptcha!.ready(() => {
      window
        .grecaptcha!.execute(siteKey, { action })
        .then(resolve)
        .catch((err: unknown) => {
          reject(
            err instanceof Error ? err : new Error('Captcha verification failed.'),
          );
        });
    });
  });
}
