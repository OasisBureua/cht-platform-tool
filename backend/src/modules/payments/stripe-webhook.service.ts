import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';
import type Stripe from 'stripe';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async processEvent(rawBody: string, signature: string): Promise<void> {
    const event = this.stripeService.constructEvent(rawBody, signature);
    this.logger.log(`[Stripe webhook] type=${event.type} id=${event.id}`);

    switch (event.type) {
      case 'account.updated':
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      case 'capability.updated':
        await this.handleCapabilityUpdated(
          event.data.object as Stripe.Capability,
        );
        break;
      case 'transfer.created':
      case 'transfer.updated':
        await this.handleTransfer(event.data.object as Stripe.Transfer);
        break;
      case 'transfer.reversed':
        await this.handleTransferReversed(event.data.object as Stripe.Transfer);
        break;
      case 'payout.paid':
      case 'payout.failed':
      case 'payout.canceled':
        await this.handlePayout(
          event.data.object as Stripe.Payout,
          event.type,
        );
        break;
      default:
        this.logger.debug(`[Stripe webhook] ignored type=${event.type}`);
    }
  }

  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    const summary = this.stripeService.summarizeAccount(account);
    const userIdMeta = account.metadata?.userId;

    // Prefer the account already linked in our DB. Only fall back to metadata
    // userId when that user has no stripeAccountId yet (first sync) — never
    // hijack a user who already has a different Connect account.
    let user = await this.prisma.user.findFirst({
      where: { stripeAccountId: account.id },
    });
    if (!user && userIdMeta) {
      const candidate = await this.prisma.user.findUnique({
        where: { id: userIdMeta },
      });
      if (candidate && !candidate.stripeAccountId) {
        user = candidate;
      } else if (candidate?.stripeAccountId) {
        this.logger.warn(
          `[Stripe webhook] account.updated metadata userId=${userIdMeta} already linked to ${candidate.stripeAccountId}; ignoring for ${account.id}`,
        );
      }
    }
    if (!user) {
      this.logger.warn(
        `[Stripe webhook] account.updated no user for ${account.id}`,
      );
      return;
    }

    const taxComplete = summary.taxComplete;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        stripeAccountId: account.id,
        stripeAccountStatus: summary.status,
        stripePayoutsEnabled: summary.payoutsEnabled,
        paymentEnabled: summary.payoutsEnabled && taxComplete,
        preferredPaymentMethod: 'ACH',
        // PAY-4: always mirror Stripe taxComplete (clears legacy Bill W-9 flags).
        w9Submitted: taxComplete,
        w9SubmittedAt: taxComplete
          ? (user.w9SubmittedAt ?? new Date())
          : null,
        ...(summary.bankAccountLast4
          ? { bankAccountLast4: summary.bankAccountLast4 }
          : {}),
        ...(summary.detailsSubmitted && !user.stripeOnboardingCompleteAt
          ? { stripeOnboardingCompleteAt: new Date() }
          : {}),
      },
    });
    this.logger.log(
      `[Stripe webhook] synced user=${user.id} account=${account.id} payouts=${summary.payoutsEnabled} tax=${taxComplete}`,
    );
  }

  private async handleCapabilityUpdated(
    capability: Stripe.Capability,
  ): Promise<void> {
    const accountId =
      typeof capability.account === 'string'
        ? capability.account
        : capability.account?.id;
    if (!accountId) return;
    try {
      const account = await this.stripeService.retrieveAccount(accountId);
      await this.handleAccountUpdated(account);
    } catch (err) {
      this.logger.warn(
        `[Stripe webhook] capability.updated retrieve failed: ${(err as Error).message}`,
      );
    }
  }

  private async handleTransfer(transfer: Stripe.Transfer): Promise<void> {
    const paymentId = transfer.metadata?.paymentId;
    const payment = await this.findPaymentForTransfer(transfer.id, paymentId);
    if (!payment) {
      this.logger.warn(
        `[Stripe webhook] transfer ${transfer.id} no matching payment`,
      );
      return;
    }

    // Transfers to Connect accounts are typically succeeded when created; reversed is separate.
    const reversed =
      (transfer.amount_reversed ?? 0) > 0 &&
      transfer.amount_reversed >= transfer.amount;

    if (reversed) {
      await this.markFailed(payment.id, payment.status, 'Transfer reversed');
      return;
    }

    if (payment.status === 'PAID') return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        stripeTransferId: transfer.id,
        paidAt: payment.paidAt ?? new Date(),
        failedAt: null,
        failureReason: null,
        deliveryMethod: 'ACH',
      },
    });

    await this.prisma.user.update({
      where: { id: payment.userId },
      data: { totalEarnings: { increment: payment.amount } },
    });

    this.logger.log(
      `[Stripe webhook] payment ${payment.id} PAID via transfer ${transfer.id}`,
    );
  }

  private async handleTransferReversed(
    transfer: Stripe.Transfer,
  ): Promise<void> {
    const paymentId = transfer.metadata?.paymentId;
    const payment = await this.findPaymentForTransfer(transfer.id, paymentId);
    if (!payment) return;
    await this.markFailed(
      payment.id,
      payment.status,
      'Transfer reversed by Stripe',
    );
  }

  private async handlePayout(
    payout: Stripe.Payout,
    eventType: string,
  ): Promise<void> {
    // Payouts on connected accounts; link via metadata if we set it, else log only.
    const paymentId = payout.metadata?.paymentId;
    if (!paymentId) {
      this.logger.debug(
        `[Stripe webhook] ${eventType} ${payout.id} no paymentId metadata`,
      );
      return;
    }
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) return;

    if (eventType === 'payout.paid') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripePayoutId: payout.id,
          status: payment.status === 'FAILED' ? payment.status : 'PAID',
          paidAt: payment.paidAt ?? new Date(),
        },
      });
      return;
    }

    if (eventType === 'payout.failed' || eventType === 'payout.canceled') {
      await this.markFailed(
        payment.id,
        payment.status,
        payout.failure_message || eventType,
      );
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { stripePayoutId: payout.id },
      });
    }
  }

  private async findPaymentForTransfer(
    transferId: string,
    paymentId?: string | null,
  ) {
    if (paymentId) {
      const byId = await this.prisma.payment.findUnique({
        where: { id: paymentId },
      });
      if (byId) return byId;
    }
    return this.prisma.payment.findFirst({
      where: { stripeTransferId: transferId },
    });
  }

  private async markFailed(
    paymentId: string,
    previousStatus: string,
    reason: string,
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) return;

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: reason.slice(0, 500),
      },
    });

    // Roll back earnings if we had already counted a PAID transfer.
    if (previousStatus === 'PAID') {
      await this.prisma.user.update({
        where: { id: payment.userId },
        data: { totalEarnings: { decrement: payment.amount } },
      });
    }

    this.logger.warn(
      `[Stripe webhook] payment ${paymentId} FAILED: ${reason}`,
    );
  }
}
