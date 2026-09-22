import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isIP } from 'node:net';
import { isProductionEnv } from '../utils/is-production-env';

interface SiteverifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

export type RecaptchaAction = 'login' | 'signup';

/** Only forward a client IP Google can use; skip ALB / private / malformed. */
function publicClientIp(remoteIp?: string): string | undefined {
  const raw = (remoteIp || '').trim();
  if (!raw) return undefined;
  const ip = raw.startsWith('::ffff:') ? raw.slice(7) : raw;
  if (isIP(ip) === 0) return undefined;
  // IPv4 private / loopback / link-local
  if (
    ip === '127.0.0.1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith('169.254.')
  ) {
    return undefined;
  }
  // IPv6 loopback / ULA / link-local
  if (
    ip === '::1' ||
    ip.toLowerCase().startsWith('fc') ||
    ip.toLowerCase().startsWith('fd') ||
    ip.toLowerCase().startsWith('fe80:')
  ) {
    return undefined;
  }
  return ip;
}

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private readonly secretKey: string;
  private readonly minScore: number;

  constructor(private readonly configService: ConfigService) {
    this.secretKey =
      this.configService.get<string>('recaptcha.secretKey')?.trim() || '';
    this.minScore = this.configService.get<number>('recaptcha.minScore') ?? 0.5;
  }

  isEnabled(): boolean {
    return this.secretKey.length > 0;
  }

  async verify(
    token: string | undefined,
    action: RecaptchaAction,
    remoteIp?: string,
  ): Promise<{ ok: true } | { error: string }> {
    // Fail-closed in production: missing secret must block login/signup.
    if (!this.isEnabled()) {
      if (isProductionEnv(this.configService.get<string>('nodeEnv'))) {
        this.logger.error(
          `[Recaptcha] RECAPTCHA_SECRET_KEY missing in production — blocking ${action}`,
        );
        return {
          error: 'Captcha is not configured. Please contact support.',
        };
      }
      return { ok: true };
    }

    const tokenStr = (token || '').trim();
    if (!tokenStr) {
      this.logger.warn(`[Recaptcha] missing token for ${action}`);
      return { error: 'Captcha verification is required.' };
    }

    const body = new URLSearchParams({
      secret: this.secretKey,
      response: tokenStr,
    });
    const clientIp = publicClientIp(remoteIp);
    if (clientIp) {
      body.set('remoteip', clientIp);
    } else if (remoteIp?.trim()) {
      this.logger.debug(
        `[Recaptcha] omitting non-public remoteip for ${action}`,
      );
    }

    const verifyStart = Date.now();
    this.logger.log(`[Recaptcha] siteverify start action=${action}`);
    let data: SiteverifyResponse;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      let res: Response;
      try {
        res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      data = (await res.json()) as SiteverifyResponse;
      this.logger.log(
        `[Recaptcha] siteverify done action=${action} in ${Date.now() - verifyStart}ms success=${!!data.success} score=${data.score ?? 'n/a'}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[Recaptcha] siteverify request failed after ${Date.now() - verifyStart}ms: ${msg}`,
      );
      return { error: 'Captcha verification failed. Please try again.' };
    }

    if (!data.success) {
      const codes = data['error-codes']?.join(', ') || 'unknown';
      this.logger.warn(`[Recaptcha] siteverify rejected token: ${codes}`);
      // Common ops causes: domain not allowlisted, site/secret key mismatch,
      // or expired / reused token (timeout-or-duplicate).
      if (codes.includes('timeout-or-duplicate')) {
        return {
          error: 'Captcha expired. Please refresh the page and try again.',
        };
      }
      if (
        codes.includes('invalid-input-secret') ||
        codes.includes('invalid-input-response')
      ) {
        this.logger.error(
          `[Recaptcha] likely site/secret key mismatch or domain not registered for this host (${codes})`,
        );
      }
      return { error: 'Captcha verification failed. Please try again.' };
    }

    // Google may omit action; only fail on an explicit mismatch.
    if (data.action && data.action !== action) {
      this.logger.warn(
        `[Recaptcha] action mismatch: expected ${action}, got ${data.action}`,
      );
      return { error: 'Captcha verification failed. Please try again.' };
    }

    if (typeof data.score === 'number' && data.score < this.minScore) {
      this.logger.warn(
        `[Recaptcha] score ${data.score} below minimum ${this.minScore} for ${action}`,
      );
      return { error: 'Captcha verification failed. Please try again.' };
    }

    return { ok: true };
  }
}
