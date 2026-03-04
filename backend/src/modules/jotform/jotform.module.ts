import { Module } from '@nestjs/common';
import { JotformController } from './jotform.controller';
import { JotformService } from './jotform.service';
import { JotformWebhookController } from './jotform-webhook.controller';
import { JotformWebhookService } from './jotform-webhook.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { QueueModule } from '../../queue/queue.module';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [JotformController, JotformWebhookController],
  providers: [JotformService, JotformWebhookService],
  exports: [JotformService],
})
export class JotformModule {}
