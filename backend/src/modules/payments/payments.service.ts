import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { CreateConnectAccountResponseDto, AccountLinkResponseDto } from './dto/create-connect-account.dto';
import { CreatePayoutDto, PayoutResponseDto } from './dto/create-payout.dto';
import { AccountStatusDto } from './dto/account-status.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('frontendUrl') || 'http://localhost:3000';
  }

  /**
   * Create Stripe Connect account for user
   */
  async createConnectAccount(userId: string): Promise<CreateConnectAccountResponseDto> {
    this.logger.log(`Creating Connect account for user: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If user already has account, return existing
    if (user.stripeAccountId) {
      this.logger.log(`User already has Stripe account: ${user.stripeAccountId}`);
      
      const accountLink = await this.createAccountLink(userId);
      
      return {
        accountId: user.stripeAccountId,
        onboardingUrl: accountLink.url,
        accountStatus: user.stripeAccountStatus ?? 'incomplete',
      };
    }

    // Create new Stripe account
    const account = await this.stripeService.createConnectAccount(user.email, userId);

    // Save account ID to database
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        stripeAccountId: account.id,
        stripeAccountStatus: 'onboarding_incomplete',
      },
    });

    // Create onboarding link
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

  /**
   * Create new account link (refresh onboarding)
   */
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

  /**
   * Get user's payment account status
   */
  async getAccountStatus(userId: string): Promise<AccountStatusDto> {
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
        accountStatus: undefined,
        paymentEnabled: false,
        w9Submitted: false,
        totalEarnings: 0,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      };
    }

    // Get account details from Stripe
    const account = await this.stripeService.getAccount(user.stripeAccountId);

    return {
      hasAccount: true,
      accountId: user.stripeAccountId,
      accountStatus: user.stripeAccountStatus ?? undefined,
      paymentEnabled: user.paymentEnabled,
      w9Submitted: user.w9Submitted,
      w9SubmittedAt: user.w9SubmittedAt?.toISOString(),
      totalEarnings: user.totalEarnings / 100, // Convert to dollars
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    };
  }

  /**
   * Create payout to user
   */
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

    // Create payment record
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
      // Create Stripe transfer
      const transfer = await this.stripeService.createTransfer(
        user.stripeAccountId,
        dto.amount,
        dto.description || 'Honorarium payment',
      );

      // Update payment record
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          stripeTransferId: transfer.id,
          paidAt: new Date(),
        },
      });

      // Update user total earnings
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

      // Mark payment as failed
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: error.message,
        },
      });

      throw new BadRequestException(`Payout failed: ${error.message}`);
    }
  }

  /**
   * Sync account status from Stripe (for testing without webhooks)
   */
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
}
