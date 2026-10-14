import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../../auth/auth.module';
import { CacheModule } from '../../cache/cache.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { CampaignExportIngestService } from './campaign-export-ingest.service';
import { ContentHubCampaignService } from './content-hub-campaign.service';
import { ContentHubClientService } from './content-hub-client.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    CacheModule,
    PrismaModule,
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 5,
    }),
  ],
  providers: [
    ContentHubClientService,
    ContentHubCampaignService,
    CampaignExportIngestService,
  ],
  exports: [
    ContentHubClientService,
    ContentHubCampaignService,
    CampaignExportIngestService,
  ],
})
export class ContentHubModule {}
