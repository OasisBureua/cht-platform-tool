import { Controller, Post, Body, Headers, Req, Logger, HttpCode } from '@nestjs/common';
import type { Request } from 'express';
import { ZoomWebhookService } from './zoom-webhook.service';

/**
 * POST /api/webhooks/zoom
 * Receives Zoom webhooks for meeting.participant_joined and meeting.participant_left.
 * Also handles endpoint.url_validation when adding webhook in Zoom App Marketplace.
 *
 * Configure in Zoom App Marketplace: Event Subscriptions → Add Endpoint
 * Events: meeting.participant_joined, meeting.participant_left
 * Set ZOOM_WEBHOOK_SECRET to the Secret Token from Zoom.
 */
@Controller('webhooks/zoom')
export class ZoomWebhookController {
  private readonly logger = new Logger(ZoomWebhookController.name);

  constructor(private readonly webhookService: ZoomWebhookService) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Body() body: unknown,
    @Headers('x-zm-signature') signature: string,
    @Headers('x-zm-request-timestamp') timestamp: string,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const rawBody = (req as Request & { rawBody?: string }).rawBody as string | undefined;
    return this.webhookService.processWebhook(body, signature ?? '', timestamp ?? '', rawBody);
  }
}
