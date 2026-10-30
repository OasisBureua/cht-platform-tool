import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from './auth.service';
import { ADMIN_CAPABILITY_KEY } from './admin-capability.decorator';
import type { AdminCapability } from '../common/admin-capabilities';
import { hasAdminCapability } from '../common/admin-capabilities';
import { isSuperAdmin } from '../common/roles';

/**
 * Enforces domain write capability on routes decorated with
 * `@RequireAdminCapability(...)`. SUPER_ADMIN always passes.
 * Use together with `@Roles(ADMIN)` for base admin access.
 */
@Injectable()
export class AdminCapabilityGuard implements CanActivate {
  private readonly logger = new Logger(AdminCapabilityGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminCapability | undefined>(
      ADMIN_CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    if (isSuperAdmin(user.role)) return true;

    if (hasAdminCapability(user.capabilities, required)) return true;

    const path = req.originalUrl ?? req.url ?? '';
    this.logger.warn(
      `[RBAC] deny userId=${user.userId} capability=${required} method=${req.method} path=${path}`,
    );
    throw new ForbiddenException(`Missing capability: ${required}`);
  }
}
