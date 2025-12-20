import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { CreateConnectAccountResponseDto } from './dto/create-connect-account.dto';
import { AccountLinkResponseDto } from './dto/account-link.dto';
import { CreatePayoutDto, PayoutResponseDto } from './dto/payout.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {
    this.frontendUrl = 'http://localhost:3000';
  }

  async createConnectAccount(userId: string): Promise<CreateConnectAccountResponseDto> {
    this.logger.log(`Creating Connect account for user: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.stripeAccountId) {
      this.logger.log(`User already has Stripe account: ${user.stripeAccountId}`);
      
      const accountLink = await this.createAccountLink(userId);
      
      return {
        accountId: user.stripeAccountId,
        onboardingUrl: accountLink.url,
        accountStatus: user.stripeAccountStatus || 'incomplete',
      };
    }

    const account = await this.stripeService.createConnectAccount(user.email, userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        stripeAccountId: account.id,
        stripeAccountStatus: 'onboarding_incomplete',
      },
    });

    const accountLink = await this.stripeService.createAccountLink(
      account.id,
      `${this.frontendUrl}/settings/payments/refresh`,
      `${this.frontendUrl}/settings/payments/complete`,
    );

    return {
      accountId: account.id,
      onboardingUrl: accountLink.url,
      accountStatus: 'onboarding_incomplete',
    };
  }

  async createAccountLink(userId: string): Promise<AccountLinkResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.stripeAccountId) {
      throw new BadRequestException('User does not have a Stripe account');
    }

    const accountLink = await this.stripeService.createAccountLink(
      user.stripeAccountId,
      `${this.frontendUrl}/settings/payments/refresh`,
      `${this.frontendUrl}/settings/payments/complete`,
    );

    return {
      url: accountLink.url,
      expiresAt: accountLink.expires_at,
    };
  }

  async getAccountStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeAccountId: true,
        stripeAccountStatus: true,
        paymentEnabled: true,
        w9Submitted: true,
        w9SubmittedAt: true,
        totalEarnings: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.stripeAccountId) {
      return {
        hasAccount: false,
        accountStatus: null,
        paymentEnabled: false,
        w9Submitted: false,
        totalEarnings: 0,
      };
    }

    const account = await this.stripeService.getAccount(user.stripeAccountId);

    return {
      hasAccount: true,
      accountId: user.stripeAccountId,
      accountStatus: user.stripeAccountStatus,  // ← This should return "active"
      paymentEnabled: user.paymentEnabled,
      w9Submitted: user.w9Submitted,
      w9SubmittedAt: user.w9SubmittedAt,
      totalEarnings: user.totalEarnings / 100,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,  // ← Fixed typo
      detailsSubmitted: account.details_submitted,
    };
  }

  async createPayout(dto: CreatePayoutDto): Promise<PayoutResponseDto> {
    this.logger.log(`Creating payout for user ${dto.userId}: $${dto.amount / 100}`);

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.paymentEnabled) {
      throw new BadRequestException('User is not enabled for payments. Complete onboarding first.');
    }

    if (!user.stripeAccountId) {
      throw new BadRequestException('User does not have a Stripe account');
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId: dto.userId,
        programId: dto.programId,
        amount: dto.amount,
        type: 'HONORARIUM',
        status: 'PENDING',
        description: dto.description,
      },
    });

    try {
      const transfer = await this.stripeService.createTransfer(
        user.stripeAccountId,
        dto.amount,
        dto.description,
      );

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          stripePaymentIntentId: transfer.id,
          paidAt: new Date(),
        },
      });

      await this.prisma.user.update({
        where: { id: dto.userId },
        data: {
          totalEarnings: { increment: dto.amount },
        },
      });

      this.logger.log(`Payout successful: ${payment.id}`);

      return {
        paymentId: payment.id,
        amount: dto.amount,
        status: 'PAID',
        transferId: transfer.id,
      };
    } catch (error) {
      this.logger.error(`Payout failed: ${error.message}`);

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
        },
      });

      throw new BadRequestException(`Payout failed: ${error.message}`);
    }
  }

  async syncAccountStatus(userId: string) {
    this.logger.log(`Syncing account status for user: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.stripeAccountId) {
      throw new NotFoundException('User does not have a Stripe account');
    }

    const account = await this.stripeService.getAccount(user.stripeAccountId);

    let status = 'onboarding_incomplete';
    let paymentEnabled = false;
    let w9Submitted = false;

    if (account.details_submitted && account.charges_enabled) {
      status = 'active';
      paymentEnabled = true;
      w9Submitted = true;
    } else if (account.details_submitted) {
      status = 'pending';
      w9Submitted = true;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        stripeAccountStatus: status,
        paymentEnabled,
        w9Submitted,
        w9SubmittedAt: w9Submitted && !user.w9SubmittedAt ? new Date() : user.w9SubmittedAt,
      },
    });

    this.logger.log(`Synced user ${userId}: status=${status}, paymentEnabled=${paymentEnabled}`);

    return {
      userId,
      stripeAccountId: user.stripeAccountId,
      previousStatus: user.stripeAccountStatus,
      newStatus: status,
      paymentEnabled,
      w9Submitted,
    };
  }

  async handleWebhookEvent(event: any) {
    this.logger.log(`Handling webhook event: ${event.type}`);

    switch (event.type) {
      case 'account.updated':
        await this.handleAccountUpdated(event.data.object);
        break;

      case 'transfer.created':
        this.logger.log(`Transfer created: ${event.data.object.id}`);
        break;

      case 'transfer.failed':
        this.logger.error(`Transfer failed: ${event.data.object.id}`);
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleAccountUpdated(account: any) {
    this.logger.log(`Account updated: ${account.id}`);

    const user = await this.prisma.user.findFirst({
      where: { stripeAccountId: account.id },
    });

    if (!user) {
      this.logger.warn(`No user found for Stripe account: ${account.id}`);
      return;
    }

    let status = 'onboarding_incomplete';
    let paymentEnabled = false;
    let w9Submitted = false;

    if (account.details_submitted && account.charges_enabled) {
      status = 'active';
      paymentEnabled = true;
      w9Submitted = true;
    } else if (account.details_submitted) {
      status = 'pending';
      w9Submitted = true;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        stripeAccountStatus: status,
        paymentEnabled,
        w9Submitted,
        w9SubmittedAt: w9Submitted && !user.w9SubmittedAt ? new Date() : user.w9SubmittedAt,
      },
    });

    this.logger.log(`Updated user ${user.id}: status=${status}, paymentEnabled=${paymentEnabled}`);
  }
}
