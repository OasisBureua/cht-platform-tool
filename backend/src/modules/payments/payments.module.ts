import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BillService } from './bill.service';
import { BillWebhookController } from './bill-webhook.controller';
import { BillWebhookService } from './bill-webhook.service';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  imports: [AuthModule],
  controllers: [
    PaymentsController,
    BillWebhookController,
    StripeWebhookController,
  ],
  providers: [
    PaymentsService,
    BillService,
    BillWebhookService,
    StripeService,
    StripeWebhookService,
  ],
  exports: [PaymentsService, BillService, StripeService],
})
export class PaymentsModule {}
