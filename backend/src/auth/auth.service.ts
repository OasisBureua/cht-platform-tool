import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

// Class (not interface) for Nest decorator metadata
export class AuthUser {
  authId: string;
  userId: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Find or create user by Auth0 sub (authId).
   * For new users, creates a minimal record; full profile can be updated later.
   */
  async findOrCreateByAuthId(
    authId: string,
    email?: string,
    firstName?: string,
    lastName?: string,
  ): Promise<AuthUser | null> {
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
        },
      });
    }

    const authUser = new AuthUser();
    authUser.authId = user.authId;
    authUser.userId = user.id;
    authUser.email = user.email;
    authUser.role = user.role;
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
    authUser.role = user.role;
    return authUser;
  }
}
