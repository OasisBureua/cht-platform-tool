import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestMethod } from '@nestjs/common';
import { join } from 'path';
import { randomUUID } from 'node:crypto';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
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
import { CacheModule } from './cache/cache.module';
import { InternalModule } from './modules/internal/internal.module';
import { AdminContentHubModule } from './modules/content-hub/admin-content-hub.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';

const usePrettyLogs = process.env.LOG_PRETTY === 'true';

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
      envFilePath: [join(__dirname, '..', '..', '.env'), '.env'],
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    CacheModule,
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 200 },
      // Tight limits for password / recover flows (15 min window)
      { name: 'auth', ttl: 900_000, limit: 10 },
      // MFA TOTP is 6 digits — keep attempts very low (5 min window)
      { name: 'authMfa', ttl: 300_000, limit: 5 },
    ]),
    PrismaModule,
    HealthModule,
    QueueModule,
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
    InternalModule,
    AdminContentHubModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
