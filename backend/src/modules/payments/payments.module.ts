import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  imports: [AuthModule],
  controllers: [
    PaymentsController,
    StripeWebhookController,
  ],
  providers: [
    PaymentsService,
    StripeService,
    StripeWebhookService,
  ],
  exports: [PaymentsService, StripeService],
})
export class PaymentsModule {}
