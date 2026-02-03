import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from './redis.service';

@Injectable()
export class SessionInterceptor implements NestInterceptor {
  constructor(private redisService: RedisService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const sessionId = request.headers['x-session-id'];

    if (sessionId) {
      // Load session data
      const sessionData = await this.redisService.get(
        this.redisService.keys.session(sessionId),
      );
      request.session = sessionData;
    }

    return next.handle().pipe(
      tap(async () => {
        // Update session with sliding expiration (3 hours)
        if (sessionId && request.session) {
          await this.redisService.set(
            this.redisService.keys.session(sessionId),
            request.session,
            10800, // 3 hours
          );
        }
      }),
    );
  }
}
