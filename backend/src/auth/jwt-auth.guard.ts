import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { SKIP_TERMS_CHECK } from './skip-terms-check.decorator';
import { TERMS_NOT_ACCEPTED_CODE } from '../common/terms';
import type { Request, Response } from 'express';
import { AuthService, AuthUser } from './auth.service';
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
    private reflector: Reflector,
  ) {
    super();
  }

  private isJwtAuthConfigured(): boolean {
    const cognitoPoolId = this.configService.get<string>('cognito.userPoolId');
    const auth0Domain = this.configService.get<string>('auth0.domain');
    return !!(cognitoPoolId || auth0Domain);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = await this.authenticate(context);
    if (ok) await this.assertTermsAccepted(context);
    return ok;
  }

  /**
   * Blocks guarded routes until the user accepts the current Terms of Service,
   * unless the handler or controller is marked @SkipTermsCheck().
   */
  private async assertTermsAccepted(context: ExecutionContext): Promise<void> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TERMS_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return;
    const user = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>().user;
    if (!user?.userId) return;
    if (await this.authService.hasAcceptedTerms(user.userId)) return;
    throw new ForbiddenException({
      statusCode: 403,
      code: TERMS_NOT_ACCEPTED_CODE,
      message:
        'Please accept the Terms of Service and Privacy Policy to continue.',
    });
  }

  /** Session / JWT / dev authentication only; used directly by OptionalJwtAuthGuard. */
  async authenticate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const response = context.switchToHttp().getResponse<Response>();
    const sessionToken = getSessionTokenFromRequest(request);

    if (sessionToken) {
      const resolved = await this.authService.resolveSession(sessionToken);
      if (resolved) {
        request.user = resolved.user;
        // Refresh cookie Max-Age only for cookie-based sessions (not header-only clients).
        const cookies = request.cookies as Record<string, unknown> | undefined;
        const cookieToken = cookies?.[SESSION_COOKIE_NAME];
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

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const devUserId = request.headers[DEV_USER_HEADER] as string | undefined;

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
