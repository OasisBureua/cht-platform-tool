import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { HubSpotService } from '../modules/hubspot/hubspot.service';
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private hubspot: HubSpotService,
  ) {}

  /**
   * Find or create user by Auth0 sub (authId).
   * Uses DB only (Redis bypassed to avoid connection/timeout issues during login).
   * For existing users, we never overwrite firstName/lastName from OAuth metadata—
   * those are managed via Settings PATCH and must persist across login/logout.
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

    if (!user) {
      this.logger.log(`Creating new user for authId: ${authId}`);
      const npi = npiNumber && String(npiNumber).replace(/\D/g, '').length === 10 ? String(npiNumber).replace(/\D/g, '').slice(0, 10) : undefined;
      user = await this.prisma.user.create({
        data: {
          authId,
          email: email || `${authId}@auth0.user`,
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
      this.hubspot.createOrUpdateContact({
        email: user.email,
        firstname: user.firstName,
        lastname: user.lastName,
        jobtitle: user.specialty ?? undefined,
        company: user.institution ?? undefined,
        city: user.city ?? undefined,
        state: user.state ?? undefined,
        zip: user.zipCode ?? undefined,
        npi_number: user.npiNumber ?? undefined,
      }).catch(() => {});
    }
    // Do NOT overwrite firstName/lastName for existing users—Settings PATCH is the source of truth.
    // OAuth metadata is only used when creating a new user.

    const authUser = new AuthUser();
    authUser.authId = user.authId;
    authUser.userId = user.id;
    authUser.email = user.email;
    authUser.name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
    authUser.role = user.role;

    return authUser;
  }

  /**
   * Invalidate cached auth user when role/email/name is updated.
   * No-op when using DB-only (no Redis cache).
   */
  async invalidateAuthCache(_userId: string): Promise<void> {
    // Auth user lookup is DB-only; no cache to invalidate
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
   * Create a session. Uses DB only (Redis bypassed to avoid connection/timeout issues).
   * @param accessToken - Optional GoTrue JWT for chatbot (stored when Supabase login)
   */
  async createSession(user: AuthUser, accessToken?: string | null): Promise<string> {
    const token = randomUUID();
    const ttl = this.configService.get<number>('sessionTtlSeconds') ?? 1800;
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
    this.logger.debug(`Session created in DB for ${user.userId}, expires: ${expiresAt.toISOString()}`);
    return token;
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
   * Get session. Uses DB only (Redis bypassed to avoid connection/timeout issues).
   */
  async getSession(token: string): Promise<AuthUser | null> {
    if (!token?.trim()) {
      this.logger.debug('[Auth] getSession: empty token');
      return null;
    }
    const trimmed = token.trim();
    const session = await this.prisma.session.findUnique({
      where: { token: trimmed },
    });
    if (!session || session.expiresAt < new Date()) {
      this.logger.debug(`[Auth] getSession: not found or expired (found=${!!session})`);
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      }
      return null;
    }
    const authUser = new AuthUser();
    authUser.authId = session.authId;
    authUser.userId = session.userId;
    authUser.email = session.email;
    authUser.name = session.name;
    authUser.role = session.role;
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
  isProfileComplete(user: { specialty: string | null; npiNumber: string | null } | null): boolean {
    if (!user || !user.specialty?.trim()) return false;
    if (user.specialty.trim() === 'Pharmaceuticals') return true;
    const npi = (user.npiNumber || '').replace(/\D/g, '');
    return npi.length === 10;
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
