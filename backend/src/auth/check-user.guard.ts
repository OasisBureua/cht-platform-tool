import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Ensures the :userId param matches the authenticated user (or user is ADMIN).
 * Place after JwtAuthGuard. Use on routes with :userId param.
 */
@Injectable()
export class CheckUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const paramUserId = request.params?.userId;

    if (!paramUserId) return true; // No userId in params

    if (user.role === UserRole.ADMIN) return true;

    if (user.userId !== paramUserId) {
      throw new ForbiddenException("Cannot access another user's resources");
    }
    return true;
  }
}
