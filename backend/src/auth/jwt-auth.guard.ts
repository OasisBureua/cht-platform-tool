import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import {
  getSessionTokenFromRequest,
  setSessionCookie,
  SESSION_COOKIE_NAME,
} from './session-cookie';
import { isProductionEnv } from '../utils/is-production-env';

const DEV_USER_HEADER = 'x-dev-user-id';

/**
 * JWT Auth Guard with session and dev bypass.
 * 1. X-Session-Token or Bearer (UUID): validate against DB session (idle + absolute TTL).
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
    const cognitoPoolId = this.configService.get<string>('cognito.userPoolId');
    const auth0Domain = this.configService.get<string>('auth0.domain');
    return !!(cognitoPoolId || auth0Domain);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const sessionToken = getSessionTokenFromRequest(request);

    if (sessionToken) {
      const resolved = await this.authService.resolveSession(sessionToken);
      if (resolved) {
        request.user = resolved.user;
        // Refresh cookie Max-Age only for cookie-based sessions (not header-only clients).
        const cookieToken = request.cookies?.[SESSION_COOKIE_NAME];
        if (
          resolved.cookieMaxAgeSeconds > 0 &&
          typeof cookieToken === 'string' &&
          cookieToken === sessionToken
        ) {
          setSessionCookie(
            response,
            sessionToken,
            resolved.cookieMaxAgeSeconds,
            this.configService.get<string>('nodeEnv'),
          );
        }
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
