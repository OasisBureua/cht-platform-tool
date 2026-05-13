import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

const DEV_USER_HEADER = 'x-dev-user-id';
const SESSION_HEADER = 'x-session-token';
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const sessionToken =
      request.headers[SESSION_HEADER] ||
      (request.headers.authorization?.startsWith?.('Bearer ')
        ? request.headers.authorization.slice(7).trim()
        : null);

    if (sessionToken && UUID_REGEX.test(sessionToken)) {
      const user = await this.authService.getSession(sessionToken);
      if (user) {
        request.user = user;
        return true;
      }
    }

    if (this.isJwtAuthConfigured()) {
      return super.canActivate(context) as Promise<boolean>;
    }
    return this.devBypass(context);
  }

  private async devBypass(context: ExecutionContext): Promise<boolean> {
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
