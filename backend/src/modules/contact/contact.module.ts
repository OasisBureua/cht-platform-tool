import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { HubSpotModule } from '../hubspot/hubspot.module';

@Module({
  imports: [HubSpotModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
