import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheService } from '../cache/redis-cache.service';

export type AuthLockoutAction =
  | 'login'
  | 'mfa'
  | 'signup'
  | 'recover';

export interface AuthLockoutCheck {
  locked: boolean;
  retryAfterSeconds?: number;
  message?: string;
}

interface LockoutState {
  failures: number;
  lockedUntil: number;
}

/** Failed attempts before lockout engages. MFA is tighter (TOTP is 6 digits). */
const FAILURE_THRESHOLD: Record<AuthLockoutAction, number> = {
  login: 5,
  mfa: 5,
  signup: 8,
  recover: 5,
};

/** Base lockout window (ms). Escalates with repeated lockouts. */
const BASE_LOCKOUT_MS: Record<AuthLockoutAction, number> = {
  login: 15 * 60_000,
  mfa: 15 * 60_000,
  signup: 15 * 60_000,
  recover: 30 * 60_000,
};

const STATE_TTL_SECONDS = 60 * 60; // keep failure counters up to 1h

@Injectable()
export class AuthLockoutService {
  private readonly logger = new Logger(AuthLockoutService.name);
  private readonly memory = new Map<string, LockoutState>();

  constructor(private readonly cache: RedisCacheService) {}

  async assertAllowed(
    action: AuthLockoutAction,
    email: string,
    ip?: string | null,
  ): Promise<AuthLockoutCheck> {
    const key = this.key(action, email, ip);
    const state = await this.read(key);
    const now = Date.now();
    if (state && state.lockedUntil > now) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((state.lockedUntil - now) / 1000),
      );
      return {
        locked: true,
        retryAfterSeconds,
        message: `Too many attempts. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
      };
    }
    return { locked: false };
  }

  async recordFailure(
    action: AuthLockoutAction,
    email: string,
    ip?: string | null,
  ): Promise<AuthLockoutCheck> {
    const key = this.key(action, email, ip);
    const now = Date.now();
    const prev = (await this.read(key)) ?? { failures: 0, lockedUntil: 0 };
    // After a lock window expires, start a fresh failure streak.
    const baseFailures =
      prev.lockedUntil > 0 && prev.lockedUntil <= now ? 0 : prev.failures;
    const failures = baseFailures + 1;

    const threshold = FAILURE_THRESHOLD[action];
    let lockedUntil = 0;
    if (failures >= threshold) {
      const over = failures - threshold;
      const lockMs =
        BASE_LOCKOUT_MS[action] * Math.min(8, 2 ** Math.max(0, over));
      lockedUntil = now + lockMs;
      this.logger.warn(
        `[AuthLockout] action=${action} email=${this.maskEmail(email)} ip=${ip || 'n/a'} failures=${failures} lockedMs=${lockMs}`,
      );
    }

    const state: LockoutState = { failures, lockedUntil };
    await this.write(key, state);

    if (lockedUntil > now) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((lockedUntil - now) / 1000),
      );
      return {
        locked: true,
        retryAfterSeconds,
        message: `Too many attempts. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
      };
    }
    return { locked: false };
  }

  async recordSuccess(
    action: AuthLockoutAction,
    email: string,
    ip?: string | null,
  ): Promise<void> {
    const key = this.key(action, email, ip);
    this.memory.delete(key);
    await this.cache.del(key);
  }

  private key(action: AuthLockoutAction, email: string, ip?: string | null): string {
    const normalizedEmail = (email || '').trim().toLowerCase() || 'unknown';
    const normalizedIp = (ip || '').trim() || 'unknown';
    return `cht:auth-lockout:${action}:${normalizedEmail}:${normalizedIp}`;
  }

  private maskEmail(email: string): string {
    const e = email.trim().toLowerCase();
    const at = e.indexOf('@');
    if (at <= 1) return '***';
    return `${e[0]}***${e.slice(at)}`;
  }

  private async read(key: string): Promise<LockoutState | null> {
    const fromRedis = await this.cache.getJson<LockoutState>(key);
    if (fromRedis) return fromRedis;
    return this.memory.get(key) ?? null;
  }

  private async write(key: string, state: LockoutState): Promise<void> {
    this.memory.set(key, state);
    await this.cache.setJson(key, state, STATE_TTL_SECONDS);
  }
}
