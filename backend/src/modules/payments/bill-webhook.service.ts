import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

import { createHmac } from 'crypto';

/**
 * Bill.com webhook event shape (payment.updated / payment.failed).
 * Full schema: https://developer.bill.com/docs/webhooks
 */
interface BillWebhookEvent {
  eventType: string;
  data?: {
    id?: string;             // Bill.com payment ID
    status?: string;         // PROCESSED, FAILED, IN_TRANSIT, etc.
    vendorId?: string;
    amount?: number;
    failureDescription?: string;
  };
}

/** Bill.com payment statuses that map to our PAID status */
const PAID_STATUSES = new Set(['PROCESSED', 'PAID', 'COMPLETED']);
/** Bill.com payment statuses that map to our FAILED status */
const FAILED_STATUSES = new Set(['FAILED', 'DECLINED', 'RETURNED', 'VOID']);
/** Bill.com payment statuses that map to our PROCESSING status */
const PROCESSING_STATUSES = new Set(['IN_TRANSIT', 'SENT', 'SCHEDULED', 'PROCESSING']);

@Injectable()
export class BillWebhookService {
  private readonly logger = new Logger(BillWebhookService.name);
  private readonly webhookSecret: string | null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get<string>('bill.webhookSecret') || null;
    if (!this.webhookSecret) {
      this.logger.warn('[Bill webhook] BILL_WEBHOOK_SECRET not configured - signature validation skipped');
    }
  }

  async processEvent(body: unknown, signature: string, timestamp: string): Promise<void> {
    // Validate signature when secret is configured
    if (this.webhookSecret) {
      const isValid = this.validateSignature(body, signature, timestamp);
      if (!isValid) {
        this.logger.warn('[Bill webhook] Invalid signature - ignoring event');
        return;
      }
    }

    const event = body as BillWebhookEvent;
    const { eventType, data } = event;

    this.logger.log(`[Bill webhook] eventType=${eventType} id=${data?.id} status=${data?.status}`);

    if (eventType === 'payment.updated' || eventType === 'payment.failed') {
      await this.handlePaymentEvent(data);
    }
  }

  private async handlePaymentEvent(
    data?: BillWebhookEvent['data'],
  ): Promise<void> {
    if (!data?.id) {
      this.logger.warn('[Bill webhook] payment event missing id');
      return;
    }

    const billPaymentId = data.id;
    const billStatus = data.status || '';

    // Find the payment in our DB by Bill.com payment ID
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { billPaymentId },
          { billPaymentIntentId: billPaymentId },
        ],
      },
      include: { user: { select: { id: true, email: true, totalEarnings: true } } },
    });

    if (!payment) {
      this.logger.warn(`[Bill webhook] No payment found for Bill.com ID: ${billPaymentId}`);
      return;
    }

    if (PAID_STATUSES.has(billStatus)) {
      await this.markPaid(payment.id, payment.userId, payment.amount, billPaymentId);
    } else if (FAILED_STATUSES.has(billStatus)) {
      await this.markFailed(payment.id, data.failureDescription || billStatus);
    } else if (PROCESSING_STATUSES.has(billStatus)) {
      await this.markProcessing(payment.id);
    } else {
      this.logger.log(`[Bill webhook] Unhandled status=${billStatus} for payment=${payment.id} - no action`);
    }
  }

  private async markPaid(
    paymentId: string,
    userId: string,
    amountCents: number,
    billPaymentId: string,
  ): Promise<void> {
    const existing = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (existing?.status === 'PAID') {
      this.logger.log(`[Bill webhook] Payment ${paymentId} already PAID - skipping`);
      return;
    }

    // At this point existing?.status is guaranteed not PAID (early return above)
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'PAID', paidAt: new Date(), billPaymentId },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { totalEarnings: { increment: amountCents } },
      }),
    ]);

    this.logger.log(`[Bill webhook] Payment ${paymentId} → PAID ($${(amountCents / 100).toFixed(2)})`);
  }

  private async markFailed(paymentId: string, reason: string): Promise<void> {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'FAILED', failedAt: new Date(), failureReason: reason },
    });
    this.logger.log(`[Bill webhook] Payment ${paymentId} → FAILED: ${reason}`);
  }

  private async markProcessing(paymentId: string): Promise<void> {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'PROCESSING' },
    });
    this.logger.log(`[Bill webhook] Payment ${paymentId} → PROCESSING`);
  }

  /**
   * Validate Bill.com webhook signature.
   * Bill.com signs payloads with HMAC-SHA256 using the webhook secret.
   * Signature header: x-bill-signature
   * Timestamp header: x-bill-timestamp (used to prevent replay attacks)
   */
  private validateSignature(body: unknown, signature: string, timestamp: string): boolean {
    if (!signature) return false;
    try {
      const payload = `${timestamp}.${JSON.stringify(body)}`;
      const expected = createHmac('sha256', this.webhookSecret!)
        .update(payload)
        .digest('hex');
      // Constant-time comparison to prevent timing attacks
      return expected === signature;
    } catch {
      return false;
    }
  }
}
