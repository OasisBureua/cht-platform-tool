import { Module } from '@nestjs/common';
import { HubSpotModule } from '../hubspot/hubspot.module';
import { ContentHubModule } from '../content-hub/content-hub.module';
import { MailchimpSyncService } from './mailchimp-sync.service';
import { MediaHubSyncService } from './mediahub-sync.service';
import { OutboundSyncService } from './outbound-sync.service';

@Module({
  imports: [HubSpotModule, ContentHubModule],
  providers: [MailchimpSyncService, MediaHubSyncService, OutboundSyncService],
  exports: [OutboundSyncService],
})
export class OutboundSyncModule {}
