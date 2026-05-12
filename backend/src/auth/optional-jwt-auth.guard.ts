import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Runs JWT/session auth when credentials are present; never rejects.
 * Use on routes that must stay public without auth while enriching the payload when the user is authenticated.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtAuthGuard: JwtAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await this.jwtAuthGuard.canActivate(context);
    } catch {
      const req = context.switchToHttp().getRequest<{ user?: unknown }>();
      req.user = undefined;
    }
    return true;
  }
}
