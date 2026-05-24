import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { getSessionTokenFromRequest } from './session-cookie';
import { isProductionEnv } from '../utils/is-production-env';

const DEV_USER_HEADER = 'x-dev-user-id';

/**
 * JWT Auth Guard with session and dev bypass.
 * 1. X-Session-Token or Bearer (UUID): validate against DB session.
 * 2. When JWT configured: Bearer JWT via Passport.
 * 3. When not configured: X-Dev-User-Id header (dev fallback).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super();
  }

  private isJwtAuthConfigured(): boolean {
    const auth0Domain = this.configService.get<string>('auth0.domain');
    const gotrueSecret = this.configService.get<string>('gotrue.jwtSecret');
    return !!(auth0Domain || gotrueSecret);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionToken = getSessionTokenFromRequest(request);

    if (sessionToken) {
      const user = await this.authService.getSession(sessionToken);
      if (user) {
        request.user = user;
        return true;
      }
    }

    if (this.isJwtAuthConfigured()) {
      return super.canActivate(context) as Promise<boolean>;
    }

    if (isProductionEnv()) {
      throw new UnauthorizedException(
        'Authentication is not configured for production',
      );
    }

    return this.devBypass(context);
  }

  private async devBypass(context: ExecutionContext): Promise<boolean> {
    if (isProductionEnv()) {
      throw new UnauthorizedException(
        'Dev auth bypass is disabled in production',
      );
    }

    const request = context.switchToHttp().getRequest();
    const devUserId = request.headers[DEV_USER_HEADER];

    if (!devUserId) {
      throw new UnauthorizedException(
        `Auth not configured. For local dev, set ${DEV_USER_HEADER} header with a valid user ID.`,
      );
    }

    const user = await this.authService.findByUserId(devUserId);
    if (!user) {
      throw new UnauthorizedException(
        `User not found: ${devUserId}. Run seed to create a test user.`,
      );
    }

    request.user = user;
    return true;
  }
}
