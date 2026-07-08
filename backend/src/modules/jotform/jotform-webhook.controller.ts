import {
  Controller,
  Post,
  Body,
  Logger,
  BadRequestException,
} from '@nestjs/common';
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

  /**
   * Normalize body to the JSON string `processSubmission` expects.
   * Jotform usually sends `rawRequest` (stringified fields); some configs post submission keys at the top level.
   */
  private extractRawRequestString(
    body: Record<string, unknown> | null | undefined,
  ): string | null {
    if (!body || typeof body !== 'object') return null;
    const rr = body.rawRequest;
    if (typeof rr === 'string' && rr.trim()) return rr;
    if (rr && typeof rr === 'object') {
      try {
        return JSON.stringify(rr);
      } catch {
        return null;
      }
    }
    const sid = body.submissionID ?? body.submission_id;
    const fid = body.formID ?? body.form_id;
    if (sid != null && fid != null) {
      try {
        return JSON.stringify(body);
      } catch {
        return null;
      }
    }
    return null;
  }

  @Post()
  async handleWebhook(@Body() body: Record<string, unknown>) {
    const rawRequest = this.extractRawRequestString(body);
    if (!rawRequest) {
      this.logger.warn(
        'Jotform webhook: missing rawRequest or submission/form identifiers in body',
      );
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
