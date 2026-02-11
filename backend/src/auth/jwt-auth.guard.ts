import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

const DEV_USER_HEADER = 'x-dev-user-id';

/**
 * JWT Auth Guard with dev bypass.
 * - When AUTH0_DOMAIN is set: validates JWT via Passport strategy.
 * - When not set (local dev): accepts X-Dev-User-Id header and loads user from DB.
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
    if (!this.isJwtAuthConfigured()) {
      return this.devBypass(context);
    }
    return super.canActivate(context) as Promise<boolean>;
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
