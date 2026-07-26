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

  private sessionTtlSeconds(): number {
    return this.configService.get<number>('sessionTtlSeconds') ?? 1800;
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
    };
    await this.cache.setJson(sessionCacheKey(token), payload, remainingSec);
  }

  private async deleteSessionCache(token: string): Promise<void> {
    await this.cache.del(sessionCacheKey(token));
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
      // Fan out to HubSpot + Mailchimp + MediaHub. Fire-and-forget: a slow
      // downstream (Mailchimp is commonly the slowest) must not block signup.
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
   * Drop Redis session entries for a user (e.g. after role change).
   * Postgres remains source of truth; next getSession backfills the cache.
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
   * Create a session in Postgres and mirror it in Redis (same TTL).
   * @param accessToken - Optional GoTrue JWT for chatbot (stored when Supabase login)
   */
  async createSession(
    user: AuthUser,
    accessToken?: string | null,
  ): Promise<string> {
    const token = randomUUID();
    const ttl = this.sessionTtlSeconds();
    const expiresAt = new Date(Date.now() + ttl * 1000);
    await this.prisma.session.create({
      data: {
        token,
        authId: user.authId,
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        expiresAt,
        accessToken: accessToken || undefined,
      },
    });
    await this.writeSessionCache(token, user, expiresAt);
    this.logger.debug(
      `Session created for ${user.userId}, expires: ${expiresAt.toISOString()}`,
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
   * Get chatbot token (GoTrue JWT) for the given session. Returns null if not stored.
   */
  async getChatbotToken(sessionToken: string): Promise<string | null> {
    const session = await this.prisma.session.findUnique({
      where: { token: sessionToken.trim() },
      select: { accessToken: true, expiresAt: true },
    });
    if (!session || session.expiresAt < new Date()) return null;
    return session.accessToken;
  }

  /**
   * Get session by token, Redis first (TTL matches DB), then Postgres.
   */
  async getSession(token: string): Promise<AuthUser | null> {
    if (!token?.trim()) {
      this.logger.debug('[Auth] getSession: empty token');
      return null;
    }
    const trimmed = token.trim();

    const cached = await this.cache.getJson<CachedSession>(
      sessionCacheKey(trimmed),
    );
    if (cached) {
      const expiresAt = new Date(cached.expiresAt);
      if (expiresAt < new Date()) {
        await this.deleteSessionCache(trimmed);
      } else {
        return this.toAuthUser(cached);
      }
    }

    const session = await this.prisma.session.findUnique({
      where: { token: trimmed },
    });
    if (!session || session.expiresAt < new Date()) {
      this.logger.debug(
        `[Auth] getSession: not found or expired (found=${!!session})`,
      );
      if (session) {
        await Promise.all([
          this.prisma.session
            .delete({ where: { id: session.id } })
            .catch(() => {}),
          this.deleteSessionCache(trimmed),
        ]);
      }
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

    await this.writeSessionCache(trimmed, authUser, session.expiresAt);
    return authUser;
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
