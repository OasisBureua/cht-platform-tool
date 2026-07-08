import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../../auth/auth.module';
import { ZoomService } from './zoom.service';
import { ZoomMeetingSdkService } from './zoom-meeting-sdk.service';
import { ZoomWebhookController } from './zoom-webhook.controller';
import { ZoomWebhookService } from './zoom-webhook.service';
import { WebinarsService } from './webinars.service';
import { WebinarsController } from './webinars.controller';
import { OfficeHoursController } from './office-hours.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { HubSpotModule } from '../hubspot/hubspot.module';
import { SurveysModule } from '../surveys/surveys.module';

@Module({
  imports: [
    HttpModule.register({ timeout: 10000, maxRedirects: 5 }),
    PrismaModule,
    HubSpotModule,
    AuthModule,
    SurveysModule,
  ],
  controllers: [
    WebinarsController,
    OfficeHoursController,
    ZoomWebhookController,
  ],
  providers: [
    ZoomService,
    ZoomMeetingSdkService,
    ZoomWebhookService,
    WebinarsService,
  ],
  exports: [WebinarsService, ZoomService],
})
export class WebinarsModule {}
