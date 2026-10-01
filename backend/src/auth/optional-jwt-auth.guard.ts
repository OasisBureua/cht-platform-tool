import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Runs JWT/session auth when credentials are present; never rejects.
 * Use on routes that must stay public without auth while enriching the payload when the user is authenticated.
 * Does not enforce terms acceptance: public pages and /auth/me stay reachable before accepting.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtAuthGuard: JwtAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const ok = await this.jwtAuthGuard.authenticate(context);
      if (!ok) {
        const req = context.switchToHttp().getRequest<{ user?: unknown }>();
        req.user = undefined;
      }
    } catch {
      const req = context.switchToHttp().getRequest<{ user?: unknown }>();
      req.user = undefined;
    }
    return true;
  }
}
