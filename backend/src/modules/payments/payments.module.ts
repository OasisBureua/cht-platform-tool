import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { QueueModule } from '../../queue/queue.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BillService } from './bill.service';
import { BillWebhookController } from './bill-webhook.controller';
import { BillWebhookService } from './bill-webhook.service';

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [PaymentsController, BillWebhookController],
  providers: [PaymentsService, BillService, BillWebhookService],
  exports: [PaymentsService, BillService],
})
export class PaymentsModule {}
