import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth.service';
import { isPlatformAdmin } from '../common/roles';

/**
 * Ensures the :userId param matches the authenticated user (or user is ADMIN / SUPER_ADMIN).
 * Place after JwtAuthGuard. Use on routes with :userId param.
 */
@Injectable()
export class CheckUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // JwtAuthGuard runs first and always sets request.user.
    const request = context
      .switchToHttp()
      .getRequest<Request<{ userId?: string }> & { user: AuthUser }>();
    const user = request.user;
    const paramUserId = request.params?.userId;

    if (!paramUserId) return true; // No userId in params

    if (isPlatformAdmin(user.role)) return true;

    if (user.userId !== paramUserId) {
      throw new ForbiddenException("Cannot access another user's resources");
    }
    return true;
  }
}
