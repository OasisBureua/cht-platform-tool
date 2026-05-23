import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdminAuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase?.() ?? '';

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const actor = request.user;
    const path = request.route?.path ?? request.url ?? 'unknown';

    return next.handle().pipe(
      tap(() => {
        void this.record({
          actorId: actor?.id ?? 'unknown',
          actorEmail: actor?.email ?? null,
          action: `${method} ${path}`,
          resource: this.inferResource(path),
          resourceId: request.params?.id ?? null,
          metadata: {
            params: request.params ?? {},
            query: request.query ?? {},
          },
          ipAddress: request.ip ?? request.headers['x-forwarded-for'] ?? null,
          userAgent: request.headers['user-agent'] ?? null,
        });
      }),
    );
  }

  private inferResource(path: string): string | null {
    const match = path.match(/\/admin\/([^/:]+)/);
    return match?.[1] ?? null;
  }

  private async record(entry: {
    actorId: string;
    actorEmail: string | null;
    action: string;
    resource: string | null;
    resourceId: string | null;
    metadata: Prisma.InputJsonValue;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({ data: entry });
    } catch (error) {
      this.logger.error(
        `Failed to write admin audit log for ${entry.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
