import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

const DEV_USER_HEADER = 'x-dev-user-id';

/**
 * Allows access when user is ADMIN, or when X-Dev-User-Id is present (for local/testing).
 * Use for endpoints that are admin-only in production but need a dev bypass (e.g. Bill.com test-connection).
 */
@Injectable()
export class AdminOrDevGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.role === UserRole.ADMIN) {
      return true;
    }

    if (request.headers[DEV_USER_HEADER]) {
      return true;
    }

    throw new ForbiddenException('Admin access required');
  }
}
