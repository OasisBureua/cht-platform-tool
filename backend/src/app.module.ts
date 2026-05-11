import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestMethod } from '@nestjs/common';
import { join } from 'path';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { WebinarsModule } from './modules/webinars/webinars.module';
import { SurveysModule } from './modules/surveys/surveys.module';
import { AdminModule } from './modules/admin/admin.module';
import { JotformModule } from './modules/jotform/jotform.module';
import { HubSpotModule } from './modules/hubspot/hubspot.module';
import { OutboundSyncModule } from './modules/outbound-sync/outbound-sync.module';
import { ContactModule } from './modules/contact/contact.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';

@Module({
  imports: [
    LoggerModule.forRoot({
      forRoutes: [{ method: RequestMethod.ALL, path: '{*splat}' }],
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport:
          process.env.NODE_ENV !== 'production'
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
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 200 },
    ]),
    PrismaModule,
    HealthModule,
    RedisModule,
    QueueModule,
    AuthModule,
    DashboardModule,
    PaymentsModule,
    ProgramsModule,
    CatalogModule,
    WebinarsModule,
    SurveysModule,
    AdminModule,
    JotformModule,
    HubSpotModule,
    OutboundSyncModule,
    ContactModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
