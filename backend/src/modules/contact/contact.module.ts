import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { OutboundSyncModule } from '../outbound-sync/outbound-sync.module';

@Module({
  imports: [OutboundSyncModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
