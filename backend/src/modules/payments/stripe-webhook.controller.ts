import {
  Controller,
  Post,
  Req,
  Headers,
  Logger,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { StripeWebhookService } from './stripe-webhook.service';

/**
 * POST /api/webhooks/stripe
 * Stripe "Your account" + "Connected accounts" destinations (Test/Live).
 * Signature verified with STRIPE_WEBHOOK_SECRET and/or STRIPE_CONNECT_WEBHOOK_SECRET.
 */
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly webhookService: StripeWebhookService) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request & { rawBody?: string },
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException(
        'Missing raw body for Stripe webhook verification',
      );
    }
    this.logger.log('[Stripe webhook] received event');
    await this.webhookService.processEvent(rawBody, signature || '');
    return { received: true };
  }
}
