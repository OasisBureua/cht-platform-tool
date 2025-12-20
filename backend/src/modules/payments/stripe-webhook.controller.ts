import { Controller, Post, Headers, Body, BadRequestException, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('webhooks')
export class StripeWebhookController {
  constructor(
    private paymentsService: PaymentsService,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {}

  /**
   * POST /webhooks/stripe
   * Handle Stripe webhook events
   */
  @Post('stripe')
  @Public() // Webhooks don't use JWT auth
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    try {
      // Verify webhook signature
      if (!req.rawBody) {
        throw new BadRequestException('Missing request body');
      }

      const event = this.stripeService.constructWebhookEvent(
        req.rawBody,
        signature,
        webhookSecret,
      );

      // Handle the event
      await this.paymentsService.handleWebhookEvent(event);

      return { received: true };
    } catch (error) {
      throw new BadRequestException(`Webhook error: ${error.message}`);
    }
  }
}