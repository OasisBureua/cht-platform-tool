import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { HubSpotService } from '../hubspot/hubspot.service';
import { createHmac } from 'crypto';

/**
 * Zoom webhook payload for meeting.participant_joined / meeting.participant_left.
 * @see https://developers.zoom.us/docs/api/meetings/events/
 */
interface ZoomParticipantObject {
  id?: string | number;
  uuid?: string;
  participant?: {
    id?: string;
    user_id?: string;
    user_name?: string;
    participant_user_id?: string;
    email?: string;
    join_time?: string;
    leave_time?: string;
  };
}

interface ZoomWebhookPayload {
  event?: string;
  Event?: string;
  payload?: {
    plainToken?: string;
    PlainToken?: string;
    object?: ZoomParticipantObject;
  };
  Payload?: {
    plainToken?: string;
    PlainToken?: string;
    object?: ZoomParticipantObject;
  };
}

@Injectable()
export class ZoomWebhookService {
  private readonly logger = new Logger(ZoomWebhookService.name);
  private readonly webhookSecret: string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly hubspot: HubSpotService,
  ) {
    this.webhookSecret = this.config.get<string>('zoom.webhookSecret') || null;
    if (!this.webhookSecret) {
      this.logger.warn('[Zoom webhook] ZOOM_WEBHOOK_SECRET not configured - signature validation skipped');
    }
  }

  /**
   * Handle Zoom webhook. Returns response for URL validation or { received: true }.
   * @param rawBody - Raw request body string (for signature verification)
   */
  async processWebhook(
    body: unknown,
    signature: string,
    timestamp: string,
    rawBody?: string,
  ): Promise<Record<string, unknown>> {
    const payload = body as ZoomWebhookPayload;
    const event = payload?.event ?? payload?.Event;
    const pl = payload?.payload ?? payload?.Payload;

    // URL validation (when adding webhook in Zoom App Marketplace)
    // Zoom requires response: { plainToken, encryptedToken } at top level
    if (event === 'endpoint.url_validation') {
      const plainToken = pl?.plainToken ?? pl?.PlainToken;
      if (!plainToken) {
        this.logger.warn('[Zoom webhook] URL validation missing plainToken, payload keys:', pl ? Object.keys(pl) : []);
        return { received: true };
      }
      const encryptedToken = this.encryptToken(plainToken);
      if (!encryptedToken) {
        this.logger.warn('[Zoom webhook] ZOOM_WEBHOOK_SECRET not set - cannot encrypt token for validation');
      }
      this.logger.log('[Zoom webhook] URL validation response sent');
      return { plainToken, encryptedToken };
    }

    // Validate signature for regular events
    if (this.webhookSecret && signature && rawBody) {
      const isValid = this.validateSignature(rawBody, signature, timestamp);
      if (!isValid) {
        this.logger.warn('[Zoom webhook] Invalid signature - ignoring event');
        return { received: true };
      }
    }

    const obj = pl?.object;

    if (event === 'meeting.participant_joined' || event === 'meeting.participant_left') {
      await this.handleParticipantEvent(event, obj, payload);
    } else {
      this.logger.debug(`[Zoom webhook] Ignoring event: ${event}`);
    }

    return { received: true };
  }

  private async handleParticipantEvent(
    event: string,
    obj?: ZoomParticipantObject,
    fullPayload?: ZoomWebhookPayload,
  ): Promise<void> {
    if (!obj?.participant) {
      this.logger.warn('[Zoom webhook] participant_joined/left missing participant');
      return;
    }

    const meetingId = obj.id != null ? String(obj.id) : obj.uuid;
    if (!meetingId) {
      this.logger.warn('[Zoom webhook] participant event missing meeting id/uuid');
      return;
    }

    // Find Program by zoomMeetingId (we store the Zoom meeting ID when creating webinars)
    const program = await this.prisma.program.findFirst({
      where: {
        OR: [
          { zoomMeetingId: meetingId },
          { zoomMeetingId: obj.uuid ?? undefined },
        ],
      },
      select: { id: true },
    });

    if (!program) {
      this.logger.debug(`[Zoom webhook] No program found for meeting ${meetingId} - skipping`);
      return;
    }

    const participant = obj.participant;
    let userId: string | null = null;
    if (participant.email) {
      const user = await this.prisma.user.findUnique({
        where: { email: participant.email.trim().toLowerCase() },
        select: { id: true },
      });
      if (user) userId = user.id;
    }

    const eventType = event === 'meeting.participant_joined' ? 'JOINED' : 'LEFT';

    if (eventType === 'JOINED' && participant.email) {
      const nameParts = (participant.user_name ?? '').trim().split(/\s+/);
      const firstname = nameParts[0] ?? '';
      const lastname = nameParts.slice(1).join(' ') ?? '';
      this.hubspot.createOrUpdateContact({
        email: participant.email.trim().toLowerCase(),
        firstname: firstname || undefined,
        lastname: lastname || undefined,
      }).catch(() => {});
    }

    await this.prisma.webinarParticipantEvent.create({
      data: {
        programId: program.id,
        userId,
        event: eventType,
        zoomMeetingId: meetingId,
        zoomParticipantId: participant.id ?? participant.participant_user_id ?? undefined,
        participantName: participant.user_name ?? undefined,
        participantEmail: participant.email ?? undefined,
        rawPayload: fullPayload as object,
      },
    });

    this.logger.log(
      `[Zoom webhook] ${eventType} program=${program.id} participant=${participant.email ?? participant.user_name ?? participant.id}`,
    );
  }

  private encryptToken(plainToken: string): string {
    if (!this.webhookSecret) return '';
    return createHmac('sha256', this.webhookSecret).update(plainToken).digest('hex');
  }

  /**
   * Validate Zoom webhook signature.
   * Zoom: message = "v0:" + timestamp + ":" + rawBody, hash = HMAC-SHA256(message, secret), header = "v0=" + hash
   */
  private validateSignature(rawBody: string, signature: string, timestamp: string): boolean {
    if (!this.webhookSecret) return true;
    try {
      const message = `v0:${timestamp}:${rawBody}`;
      const hash = createHmac('sha256', this.webhookSecret).update(message).digest('hex');
      const expected = `v0=${hash}`;
      return signature === expected;
    } catch {
      return false;
    }
  }
}
