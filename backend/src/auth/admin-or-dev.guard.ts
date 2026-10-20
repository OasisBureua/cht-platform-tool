import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth.service';
import { isProductionEnv } from '../utils/is-production-env';
import { isPlatformAdmin } from '../common/roles';

const DEV_USER_HEADER = 'x-dev-user-id';

/**
 * Allows access when user is ADMIN/SUPER_ADMIN, or when X-Dev-User-Id is present (for local/testing).
 * Use for endpoints that are admin-only in production but need a dev bypass.
 */
@Injectable()
export class AdminOrDevGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;

    if (isPlatformAdmin(user?.role)) {
      return true;
    }

    if (!isProductionEnv() && request.headers[DEV_USER_HEADER]) {
      return true;
    }

    throw new ForbiddenException('Admin access required');
  }
}
