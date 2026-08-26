import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AdminContentHubModule } from '../content-hub/admin-content-hub.module';
import { HubSpotModule } from '../hubspot/hubspot.module';
import { SurveysModule } from '../surveys/surveys.module';
import { JotformModule } from '../jotform/jotform.module';
import { AdminCampaignsController } from './admin-campaigns.controller';
import { CampaignsDashboardService } from './campaigns-dashboard.service';
import { CampaignsFunnelService } from './campaigns-funnel.service';

@Module({
  imports: [
    AuthModule,
    HubSpotModule,
    AdminContentHubModule,
    SurveysModule,
    JotformModule,
  ],
  controllers: [AdminCampaignsController],
  providers: [CampaignsDashboardService, CampaignsFunnelService],
})
export class CampaignsModule {}
