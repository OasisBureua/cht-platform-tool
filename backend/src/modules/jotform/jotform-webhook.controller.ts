import { Controller, Post, Body, Logger, BadRequestException } from '@nestjs/common';
import { JotformWebhookService } from './jotform-webhook.service';

/**
 * Receives Jotform webhook POST when a form is submitted.
 * Jotform sends multipart/form-data with rawRequest (JSON string).
 * Webhook URL: https://testapp.communityhealth.media/api/webhooks/jotform
 */
@Controller('webhooks/jotform')
export class JotformWebhookController {
  private readonly logger = new Logger(JotformWebhookController.name);

  constructor(private readonly webhookService: JotformWebhookService) {}

  @Post()
  async handleWebhook(@Body() body: { rawRequest?: string }) {
    const rawRequest = body?.rawRequest;
    if (!rawRequest || typeof rawRequest !== 'string') {
      this.logger.warn('Jotform webhook: missing rawRequest in body');
      return { received: true };
    }

    try {
      const result = await this.webhookService.processSubmission(rawRequest);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Jotform webhook error: ${msg}`);
      if (err instanceof BadRequestException) throw err;
      return { received: true, error: msg };
    }
  }
}
