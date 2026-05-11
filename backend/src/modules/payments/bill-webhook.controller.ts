import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { BillWebhookService } from './bill-webhook.service';

/**
 * POST /api/webhooks/bill
 * Receives payment.updated and payment.failed events from Bill.com.
 * No auth guard - Bill.com calls this from their servers.
 * Signature validated inside the service using BILL_WEBHOOK_SECRET.
 */
@Controller('webhooks/bill')
export class BillWebhookController {
  private readonly logger = new Logger(BillWebhookController.name);

  constructor(private readonly webhookService: BillWebhookService) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Body() body: unknown,
    @Headers('x-bill-signature') signature: string,
    @Headers('x-bill-timestamp') timestamp: string,
  ): Promise<{ received: boolean }> {
    this.logger.log(`[Bill webhook] received event`);
    await this.webhookService.processEvent(body, signature, timestamp);
    return { received: true };
  }
}
