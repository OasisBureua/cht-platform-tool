import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SiteverifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

export type RecaptchaAction = 'login' | 'signup';

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
    if (!this.isEnabled()) {
      return { ok: true };
    }

    const tokenStr = (token || '').trim();
    if (!tokenStr) {
      return { error: 'Captcha verification is required.' };
    }

    const body = new URLSearchParams({
      secret: this.secretKey,
      response: tokenStr,
    });
    if (remoteIp) {
      body.set('remoteip', remoteIp);
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
        `[Recaptcha] siteverify done action=${action} in ${Date.now() - verifyStart}ms success=${!!data.success}`,
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
      return { error: 'Captcha verification failed. Please try again.' };
    }

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
