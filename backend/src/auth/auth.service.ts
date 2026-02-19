import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
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

// Plain object for Redis serialization
interface AuthUserCache {
  authId: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

interface SessionCache {
  authId: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private configService: ConfigService,
  ) {}

  /**
   * Find or create user by Auth0 sub (authId).
   * Caches result in Redis (30 min TTL) to avoid DB lookup on every request.
   */
  async findOrCreateByAuthId(
    authId: string,
    email?: string,
    firstName?: string,
    lastName?: string,
    npiNumber?: string | null,
  ): Promise<AuthUser | null> {
    const cacheKey = this.redis.keys.authUser(authId);
    const cached = await this.redis.get<AuthUserCache>(cacheKey);
    if (cached) {
      const authUser = new AuthUser();
      Object.assign(authUser, cached);
      authUser.name = cached.name || cached.email || 'User';
      return authUser;
    }

    let user = await this.prisma.user.findUnique({
      where: { authId },
    });

    if (!user) {
      this.logger.log(`Creating new user for authId: ${authId}`);
      user = await this.prisma.user.create({
        data: {
          authId,
          email: email || `${authId}@auth0.user`,
          firstName: firstName || 'User',
          lastName: lastName || '',
          npiNumber: npiNumber || undefined,
        },
      });
    }

    const authUser = new AuthUser();
    authUser.authId = user.authId;
    authUser.userId = user.id;
    authUser.email = user.email;
    authUser.name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
    authUser.role = user.role;

    const toCache: AuthUserCache = {
      authId: authUser.authId,
      userId: authUser.userId,
      email: authUser.email,
      name: authUser.name,
      role: authUser.role,
    };
    await this.redis.set(cacheKey, toCache, this.redis.ttl.user);
    return authUser;
  }

  /**
   * Invalidate cached auth user when role/email/name is updated.
   * Call after admin updates user profile so subsequent requests get fresh data.
   */
  async invalidateAuthCache(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { authId: true },
    });
    if (user?.authId) {
      await this.redis.del(this.redis.keys.authUser(user.authId));
      this.logger.debug(`Invalidated auth cache for user ${userId}`);
    }
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
    authUser.name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
    authUser.role = user.role;
    return authUser;
  }

  /**
   * Create a session in Redis. Returns session token.
   */
  async createSession(user: AuthUser): Promise<string> {
    const token = randomUUID();
    const ttl = this.configService.get<number>('sessionTtlSeconds') ?? 1800;
    const cache: SessionCache = {
      authId: user.authId,
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    await this.redis.set(this.redis.keys.session(token), cache, ttl);
    this.logger.debug(`Session created for ${user.userId}, TTL: ${ttl}s`);
    return token;
  }

  /**
   * Get session from Redis. Returns AuthUser if valid.
   */
  async getSession(token: string): Promise<AuthUser | null> {
    const cached = await this.redis.get<SessionCache>(this.redis.keys.session(token));
    if (!cached) return null;
    const authUser = new AuthUser();
    Object.assign(authUser, cached);
    return authUser;
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
    authUser.name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
    authUser.role = user.role;
    return authUser;
  }
}
