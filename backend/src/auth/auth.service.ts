import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OutboundSyncService } from '../modules/outbound-sync/outbound-sync.service';
import { CognitoService } from './cognito.service';
import { isProfileCompleteForPayments } from '../common/profile-payment-eligibility';
import { RedisCacheService } from '../cache/redis-cache.service';
import { sessionCacheKey } from '../cache/cache-keys';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';

// Class (not interface) for Nest decorator metadata
export class AuthUser {
  authId: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

type CachedSession = {
  authId: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  expiresAt: string;
  createdAt: string;
};

/** Result of resolving a session token (includes cookie Max-Age hint). */
export type ResolvedSession = {
  user: AuthUser;
  /** Seconds remaining until absolute expiry — use for Set-Cookie Max-Age. */
  cookieMaxAgeSeconds: number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private outboundSync: OutboundSyncService,
    private cognitoService: CognitoService,
    private cache: RedisCacheService,
  ) {}

  /** Idle window (default 30 min). Slid forward on authenticated activity. */
  private sessionIdleTtlSeconds(): number {
    return this.configService.get<number>('sessionTtlSeconds') ?? 1800;
  }

  /** Hard cap from session create (default 8h). Not extended by activity. */
  private sessionAbsoluteTtlSeconds(): number {
    return this.configService.get<number>('sessionAbsoluteTtlSeconds') ?? 28800;
  }

  private absoluteDeadline(createdAt: Date): Date {
    return new Date(
      createdAt.getTime() + this.sessionAbsoluteTtlSeconds() * 1000,
    );
  }

  /** Next idle expiry, never past the absolute deadline. */
  private nextIdleExpiresAt(now: Date, createdAt: Date): Date {
    const idleEnd = new Date(
      now.getTime() + this.sessionIdleTtlSeconds() * 1000,
    );
    const absEnd = this.absoluteDeadline(createdAt);
    return idleEnd.getTime() < absEnd.getTime() ? idleEnd : absEnd;
  }

  private remainingAbsoluteSeconds(createdAt: Date, now = new Date()): number {
    return Math.max(
      0,
      Math.floor((this.absoluteDeadline(createdAt).getTime() - now.getTime()) / 1000),
    );
  }

  private isSessionTimedOut(
    now: Date,
    expiresAt: Date,
    createdAt: Date,
  ): boolean {
    return (
      now.getTime() >= this.absoluteDeadline(createdAt).getTime() ||
      now.getTime() >= expiresAt.getTime()
    );
  }

  private toAuthUser(data: {
    authId: string;
    userId: string;
    email: string;
    name: string;
    role: UserRole;
  }): AuthUser {
    const authUser = new AuthUser();
    authUser.authId = data.authId;
    authUser.userId = data.userId;
    authUser.email = data.email;
    authUser.name = data.name;
    authUser.role = data.role;
    return authUser;
  }

  private async writeSessionCache(
    token: string,
    user: AuthUser,
    expiresAt: Date,
    createdAt: Date,
  ): Promise<void> {
    const remainingSec = Math.max(
      1,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );
    const payload: CachedSession = {
      authId: user.authId,
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      expiresAt: expiresAt.toISOString(),
      createdAt: createdAt.toISOString(),
    };
    await this.cache.setJson(sessionCacheKey(token), payload, remainingSec);
  }

  private async deleteSessionCache(token: string): Promise<void> {
    await this.cache.del(sessionCacheKey(token));
  }

  private async destroySessionRow(
    token: string,
    sessionId?: string,
  ): Promise<void> {
    await Promise.all([
      sessionId
        ? this.prisma.session.delete({ where: { id: sessionId } }).catch(() => {})
        : this.prisma.session.deleteMany({ where: { token } }),
      this.deleteSessionCache(token),
    ]);
  }
  /**
   * SCRUM-188: return the user (id + email) that owns a given NPI, or null.
   * Used by signup + profile-update to block duplicate NPI registration
   * before hitting the DB unique constraint.
   */
  async findByNpi(
    npiNumber: string,
  ): Promise<{ id: string; email: string } | null> {
    const digits = npiNumber.replace(/\D/g, '');
    if (digits.length !== 10) return null;
    return this.prisma.user.findUnique({
      where: { npiNumber: digits },
      select: { id: true, email: true },
    });
  }

  /**
   * Find or create user by Auth0 sub (authId).
   * For existing users, we never overwrite firstName/lastName from OAuth metadata;
   * those values are managed via Settings PATCH and must persist across login/logout.
   */
  async findOrCreateByAuthId(
    authId: string,
    email?: string,
    firstName?: string,
    lastName?: string,
    npiNumber?: string | null,
    specialty?: string | null,
    institution?: string | null,
    city?: string | null,
    state?: string | null,
    zipCode?: string | null,
  ): Promise<AuthUser | null> {
    let user = await this.prisma.user.findUnique({
      where: { authId },
    });

    if (!user && email?.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      const byEmail = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (byEmail) {
        this.logger.log(
          `Linking existing user ${byEmail.id} (${normalizedEmail}) to authId ${authId}`,
        );
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { authId },
        });
        this.cognitoService
          .syncGroupsForRole(user.email, user.role)
          .catch((err) =>
            this.logger.warn(
              `[Auth] Cognito group sync after authId link failed: ${err}`,
            ),
          );
      }
    }

    if (!user) {
      this.logger.log(`Creating new user for authId: ${authId}`);
      const npi =
        npiNumber && String(npiNumber).replace(/\D/g, '').length === 10
          ? String(npiNumber).replace(/\D/g, '').slice(0, 10)
          : undefined;
      user = await this.prisma.user.create({
        data: {
          authId,
          email: (email || `${authId}@auth0.user`).trim().toLowerCase(),
          firstName: firstName || 'User',
          lastName: lastName || '',
          npiNumber: npi,
          specialty: specialty?.trim() || undefined,
          institution: institution?.trim() || undefined,
          city: city?.trim() || undefined,
          state: state?.trim() || undefined,
          zipCode: zipCode?.trim() || undefined,
        },
      });
      // Fan out to HubSpot + Content Hub. Fire-and-forget: a slow
      // downstream must not block signup.
      this.outboundSync
        .syncUser({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          npiNumber: user.npiNumber,
          specialty: user.specialty,
          institution: user.institution,
          city: user.city,
          state: user.state,
          zipCode: user.zipCode,
        })
        .catch((err) => this.logger.error('[Auth] outbound-sync error:', err));
    }
    // Do NOT overwrite firstName/lastName for existing users - Settings PATCH is the source of truth.
    // OAuth metadata is only used when creating a new user.

    const authUser = new AuthUser();
    authUser.authId = user.authId;
    authUser.userId = user.id;
    authUser.email = user.email;
    authUser.name =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.email;
    authUser.role = user.role;

    return authUser;
  }

  /**
   * Drop Redis session entries for a user without deleting Postgres rows.
   *
   * Use this when sessions should remain valid but cached AuthUser data is
   * stale (e.g. role change via `setUserRole`). Postgres stays source of
   * truth; the next `getSession` backfills Redis with fresh fields.
   *
   * Do **not** use this for password reset/change — call
   * `revokeAllUserSessions` instead so Postgres rows are deleted too.
   * Redis-only invalidation would allow the next request to rehydrate from
   * still-valid Session rows.
   */
  async invalidateAuthCache(userId: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      select: { token: true },
    });
    await Promise.all(
      sessions.map((s) => this.deleteSessionCache(s.token)),
    );
  }

  /**
   * Fully revoke every session for a user (Postgres + Redis).
   * Call after confirmForgotPassword or an authenticated password change so
   * stolen cookies cannot keep working.
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      select: { token: true },
    });
    await this.prisma.session.deleteMany({ where: { userId } });
    await Promise.all(sessions.map((s) => this.deleteSessionCache(s.token)));
    this.logger.log(
      `[Auth] Revoked ${sessions.length} session(s) for userId=${userId}`,
    );
    return sessions.length;
  }

  /** Cognito (or legacy) access token stored on the session row, if any. */
  async getSessionAccessToken(sessionToken: string): Promise<string | null> {
    const token = sessionToken.trim();
    if (!token) return null;
    const session = await this.prisma.session.findUnique({
      where: { token },
      select: { accessToken: true, expiresAt: true, createdAt: true },
    });
    if (
      !session ||
      this.isSessionTimedOut(new Date(), session.expiresAt, session.createdAt)
    ) {
      return null;
    }
    return session.accessToken ?? null;
  }

  /**
   * Update Postgres role, refresh active sessions, and sync Cognito groups.
   */
  async setUserRole(
    userId: string,
    role: UserRole,
  ): Promise<{ id: string; email: string; role: UserRole }> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    await this.prisma.session.updateMany({
      where: { userId },
      data: { role },
    });

    await this.cognitoService.syncGroupsForRole(updated.email, role);
    await this.invalidateAuthCache(userId);

    return updated;
  }

  /**
   * Find user by email (for dev login).
   */
  async findByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return null;
    const authUser = new AuthUser();
    authUser.authId = user.authId;
    authUser.userId = user.id;
    authUser.email = user.email;
    authUser.name =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.email;
    authUser.role = user.role;
    return authUser;
  }

  /**
   * Create a session in Postgres and mirror it in Redis.
   * Idle expiry starts at now + SESSION_TTL_SECONDS; absolute cap uses createdAt.
   * @param accessToken - Optional Cognito/legacy access token (MFA, password change)
   */
  async createSession(
    user: AuthUser,
    accessToken?: string | null,
  ): Promise<string> {
    const token = randomUUID();
    const now = new Date();
    const createdAt = now;
    const expiresAt = this.nextIdleExpiresAt(now, createdAt);
    await this.prisma.session.create({
      data: {
        token,
        authId: user.authId,
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        expiresAt,
        createdAt,
        accessToken: accessToken || undefined,
      },
    });
    await this.writeSessionCache(token, user, expiresAt, createdAt);
    this.logger.debug(
      `Session created for ${user.userId}, idleExpires=${expiresAt.toISOString()} absoluteDeadline=${this.absoluteDeadline(createdAt).toISOString()}`,
    );
    return token;
  }

  async revokeSession(sessionToken: string): Promise<void> {
    const token = sessionToken.trim();
    if (!token) return;
    await Promise.all([
      this.prisma.session.deleteMany({ where: { token } }),
      this.deleteSessionCache(token),
    ]);
  }

  /**
   * Resolve session by token: Redis first, then Postgres.
   * Enforces idle + absolute timeouts and slides idle expiry on activity
   * (when less than half the idle window remains) so active users stay signed in
   * until the absolute cap.
   */
  async resolveSession(token: string): Promise<ResolvedSession | null> {
    if (!token?.trim()) {
      this.logger.debug('[Auth] getSession: empty token');
      return null;
    }
    const trimmed = token.trim();
    const now = new Date();

    const cached = await this.cache.getJson<CachedSession>(
      sessionCacheKey(trimmed),
    );
    // Legacy Redis payloads (pre–absolute TTL) lack createdAt — fall through to Postgres.
    if (cached?.expiresAt && cached.createdAt) {
      const expiresAt = new Date(cached.expiresAt);
      const createdAt = new Date(cached.createdAt);
      if (
        Number.isNaN(expiresAt.getTime()) ||
        Number.isNaN(createdAt.getTime())
      ) {
        await this.deleteSessionCache(trimmed);
      } else if (this.isSessionTimedOut(now, expiresAt, createdAt)) {
        await this.destroySessionRow(trimmed);
        return null;
      } else {
        const user = this.toAuthUser(cached);
        await this.maybeSlideSession(
          trimmed,
          user,
          expiresAt,
          createdAt,
          now,
        );
        return {
          user,
          cookieMaxAgeSeconds: this.remainingAbsoluteSeconds(createdAt, now),
        };
      }
    } else if (cached) {
      // Stale shape — drop cache entry and rehydrate from Postgres.
      await this.deleteSessionCache(trimmed);
    }

    const session = await this.prisma.session.findUnique({
      where: { token: trimmed },
    });
    if (!session) {
      this.logger.debug('[Auth] getSession: not found');
      return null;
    }

    // createdAt is required after migration; coerce for safety mid-rollout.
    const createdAt =
      session.createdAt instanceof Date && !Number.isNaN(session.createdAt.getTime())
        ? session.createdAt
        : new Date(
            session.expiresAt.getTime() - this.sessionIdleTtlSeconds() * 1000,
          );
    if (this.isSessionTimedOut(now, session.expiresAt, createdAt)) {
      this.logger.debug(
        `[Auth] getSession: timed out (idle or absolute) token=${trimmed.slice(0, 8)}…`,
      );
      await this.destroySessionRow(trimmed, session.id);
      return null;
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true },
    });

    const role = dbUser?.role ?? session.role;
    const authUser = this.toAuthUser({
      authId: session.authId,
      userId: session.userId,
      email: session.email,
      name: session.name,
      role,
    });

    if (dbUser && dbUser.role !== session.role) {
      await this.prisma.session
        .update({
          where: { id: session.id },
          data: { role: dbUser.role },
        })
        .catch(() => {});
    }

    await this.maybeSlideSession(
      trimmed,
      authUser,
      session.expiresAt,
      createdAt,
      now,
      session.id,
    );

    return {
      user: authUser,
      cookieMaxAgeSeconds: this.remainingAbsoluteSeconds(createdAt, now),
    };
  }

  /**
   * Slide idle expiry when less than half the idle window remains.
   * Caps at absolute deadline. Updates Postgres + Redis.
   */
  private async maybeSlideSession(
    token: string,
    user: AuthUser,
    expiresAt: Date,
    createdAt: Date,
    now: Date,
    sessionId?: string,
  ): Promise<boolean> {
    const idleTtl = this.sessionIdleTtlSeconds();
    const remainingIdleSec = Math.floor(
      (expiresAt.getTime() - now.getTime()) / 1000,
    );
    const shouldSlide = remainingIdleSec < idleTtl / 2;
    if (!shouldSlide) {
      await this.writeSessionCache(token, user, expiresAt, createdAt);
      return false;
    }

    const newExpiresAt = this.nextIdleExpiresAt(now, createdAt);
    if (sessionId) {
      await this.prisma.session
        .update({
          where: { id: sessionId },
          data: { expiresAt: newExpiresAt },
        })
        .catch(() => {});
    } else {
      await this.prisma.session
        .updateMany({
          where: { token },
          data: { expiresAt: newExpiresAt },
        })
        .catch(() => {});
    }
    await this.writeSessionCache(token, user, newExpiresAt, createdAt);
    return true;
  }

  /** Get session by token (AuthUser only). Prefer resolveSession when refreshing cookies. */
  async getSession(token: string): Promise<AuthUser | null> {
    const resolved = await this.resolveSession(token);
    return resolved?.user ?? null;
  }

  /**
   * Get user by DB userId (for /me to return firstName, lastName, profileComplete).
   */
  async getUserById(userId: string): Promise<{
    firstName: string;
    lastName: string;
    specialty: string | null;
    npiNumber: string | null;
    institution: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        specialty: true,
        npiNumber: true,
        institution: true,
        city: true,
        state: true,
        zipCode: true,
      },
    });
    return user;
  }

  /**
   * Check if user has completed required profile.
   * Requires: specialty. NPI required unless profession is Pharmaceuticals.
   */
  isProfileComplete(
    user: { specialty: string | null; npiNumber: string | null } | null,
  ): boolean {
    return isProfileCompleteForPayments(user);
  }

  /**
   * Find user by DB userId (for dev bypass with X-Dev-User-Id).
   */
  async findByUserId(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return null;
    const authUser = new AuthUser();
    authUser.authId = user.authId;
    authUser.userId = user.id;
    authUser.email = user.email;
    authUser.name =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.email;
    authUser.role = user.role;
    return authUser;
  }
}
