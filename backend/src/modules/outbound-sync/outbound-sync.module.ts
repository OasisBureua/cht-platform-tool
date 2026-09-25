import { Module } from '@nestjs/common';
import { HubSpotModule } from '../hubspot/hubspot.module';
import { ContentHubModule } from '../content-hub/content-hub.module';
import { ContentHubSyncService } from './contenthub-sync.service';
import { OutboundSyncService } from './outbound-sync.service';

@Module({
  imports: [HubSpotModule, ContentHubModule],
  providers: [ContentHubSyncService, OutboundSyncService],
  exports: [OutboundSyncService],
})
export class OutboundSyncModule {}
