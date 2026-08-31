import { Module, RequestMethod } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { join } from 'path';
import { randomUUID } from 'node:crypto';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { PodcastsModule } from './modules/podcasts/podcasts.module';
import { KolNetworkModule } from './modules/kol-network/kol-network.module';
import { WebinarsModule } from './modules/webinars/webinars.module';
import { SurveysModule } from './modules/surveys/surveys.module';
import { AdminModule } from './modules/admin/admin.module';
import { JotformModule } from './modules/jotform/jotform.module';
import { HubSpotModule } from './modules/hubspot/hubspot.module';
import { OutboundSyncModule } from './modules/outbound-sync/outbound-sync.module';
import { ContactModule } from './modules/contact/contact.module';
import { InvitesModule } from './modules/invites/invites.module';
import { CacheModule } from './cache/cache.module';
import { InternalModule } from './modules/internal/internal.module';
import { AdminContentHubModule } from './modules/content-hub/admin-content-hub.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { ConfigModule } from '@nestjs/config';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';

const usePrettyLogs = process.env.LOG_PRETTY === 'true';

const throttleReflector = new Reflector();

/** ALB + ECS probe paths must never count toward rate limits. */
function skipHealthProbes(context: ExecutionContext): boolean {
  const req = context.switchToHttp().getRequest<{ url?: string }>();
  const path = (req.url || '').split('?')[0];
  return (
    path === '/health' ||
    path.startsWith('/health/') ||
    path === '/actuator' ||
    path.startsWith('/actuator/')
  );
}

/**
 * auth / authMfa throttlers are registered globally so @Throttle({ auth }) works,
 * but must NOT apply to normal API traffic. Only enforce when a route sets
 * @Throttle({ auth: … }) / @Throttle({ authMfa: … }) (limit metadata present).
 */
function skipUnlessExplicitThrottle(throttlerName: string) {
  return (context: ExecutionContext): boolean => {
    const limit = throttleReflector.getAllAndOverride<number>(
      `THROTTLER:LIMIT${throttlerName}`,
      [context.getHandler(), context.getClass()],
    );
    return limit == null;
  };
}

function skipHealthOrUnlessAuthThrottle(throttlerName: string) {
  return (context: ExecutionContext): boolean =>
    skipHealthProbes(context) ||
    skipUnlessExplicitThrottle(throttlerName)(context);
}

@Module({
  imports: [
    LoggerModule.forRoot({
      forRoutes: [{ method: RequestMethod.ALL, path: '{*splat}' }],
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        genReqId: (req) => {
          const incoming = req.headers['x-request-id'];
          if (typeof incoming === 'string' && incoming.trim()) {
            return incoming.trim();
          }
          if (Array.isArray(incoming)) {
            const first = incoming.find((v) => typeof v === 'string' && v.trim());
            if (first?.trim()) return first.trim();
          }
          return randomUUID();
        },
        transport: usePrettyLogs
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      // First file wins (dotenv does not override). Prefer backend/.env
      // whether cwd is backend/ or the repo root.
      envFilePath: [
        join(__dirname, '..', '.env'),
        join(process.cwd(), 'backend', '.env'),
        join(process.cwd(), '.env'),
        '.env',
      ],
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    CacheModule,
    ThrottlerModule.forRoot([
      // SPA pages fan out many parallel GETs (catalog biomarkers, auth/me, dashboard).
      // Keep these high enough for a normal page load; auth* stays tight below.
      { name: 'short', ttl: 1000, limit: 60, skipIf: skipHealthProbes },
      { name: 'medium', ttl: 10000, limit: 300, skipIf: skipHealthProbes },
      { name: 'long', ttl: 60000, limit: 1200, skipIf: skipHealthProbes },
      // Tight limits for password / recover — only when @Throttle({ auth }) is set
      {
        name: 'auth',
        ttl: 900_000,
        limit: 10,
        skipIf: skipHealthOrUnlessAuthThrottle('auth'),
      },
      // MFA TOTP — only when @Throttle({ authMfa }) is set
      {
        name: 'authMfa',
        ttl: 300_000,
        limit: 5,
        skipIf: skipHealthOrUnlessAuthThrottle('authMfa'),
      },
    ]),
    PrismaModule,
    AuditModule,
    HealthModule,
    QueueModule,
    FeatureFlagsModule,
    AuthModule,
    DashboardModule,
    PaymentsModule,
    ProgramsModule,
    CatalogModule,
    PodcastsModule,
    KolNetworkModule,
    WebinarsModule,
    SurveysModule,
    AdminModule,
    JotformModule,
    HubSpotModule,
    OutboundSyncModule,
    ContactModule,
    InvitesModule,
    InternalModule,
    AdminContentHubModule,
    CampaignsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
