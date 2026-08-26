import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Skip noisy / system paths. Auth events are logged explicitly via AuditService. */
const SKIP_PREFIXES = [
  '/api/webhooks/',
  '/api/health',
  '/api/actuator',
  '/api/internal/',
  '/api/auth/',
];

/**
 * Logs authenticated mutating HTTP requests for all roles (ADMIN + HCP).
 * Auth events without a session (login/recover) are recorded explicitly via AuditService.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase?.() ?? '';
    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const url: string = request.originalUrl || request.url || '';
    if (SKIP_PREFIXES.some((p) => url.startsWith(p))) {
      return next.handle();
    }

    const actor = request.user;
    const actorId = actor?.userId ?? actor?.id;
    if (!actorId) {
      // Unauthenticated mutations (login/signup/recover) are logged explicitly.
      return next.handle();
    }

    const path = request.route?.path ?? url;
    const resource = this.inferResource(path, url);

    return next.handle().pipe(
      tap(() => {
        this.audit.record({
          actorId: String(actorId),
          actorEmail: actor.email ?? null,
          actorRole: actor.role ? String(actor.role) : null,
          action: `${method} ${path}`,
          resource,
          resourceId:
            request.params?.id ??
            request.params?.programId ??
            request.params?.paymentId ??
            null,
          metadata: {
            params: request.params ?? {},
            query: request.query ?? {},
          },
          ipAddress:
            request.ip ??
            (typeof request.headers['x-forwarded-for'] === 'string'
              ? request.headers['x-forwarded-for']
              : null),
          userAgent:
            typeof request.headers['user-agent'] === 'string'
              ? request.headers['user-agent']
              : null,
        });
      }),
    );
  }

  private inferResource(path: string, url: string): string | null {
    const admin = path.match(/\/admin\/([^/:]+)/);
    if (admin?.[1]) return admin[1];
    const api = url.match(/\/api\/([^/?]+)/);
    return api?.[1] ?? null;
  }
}
