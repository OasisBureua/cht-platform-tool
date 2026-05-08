import { Module } from '@nestjs/common';
import { HubSpotModule } from '../hubspot/hubspot.module';
import { MailchimpSyncService } from './mailchimp-sync.service';
import { MediaHubSyncService } from './mediahub-sync.service';
import { OutboundSyncService } from './outbound-sync.service';

@Module({
  imports: [HubSpotModule],
  providers: [MailchimpSyncService, MediaHubSyncService, OutboundSyncService],
  exports: [OutboundSyncService],
})
export class OutboundSyncModule {}
