import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BillService } from './bill.service';
import { QueueService } from '../../queue/queue.service';
import { CreateConnectAccountResponseDto, AccountLinkResponseDto } from './dto/create-connect-account.dto';
import { CreatePayoutDto, PayoutResponseDto } from './dto/create-payout.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { AccountStatusDto } from './dto/account-status.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private billService: BillService,
    private configService: ConfigService,
    private queueService: QueueService,
  ) {
    this.frontendUrl = this.configService.get<string>('frontendUrl') || 'http://localhost:3000';
  }

  /**
   * Save Bill.com vendorId after frontend Elements SDK vendorSetupSuccess event.
   */
  async saveVendorId(userId: string, vendorId: string): Promise<{ saved: boolean }> {
    if (!vendorId?.trim()) throw new BadRequestException('vendorId is required');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        billVendorId: vendorId.trim(),
        billVendorStatus: 'active',
        paymentEnabled: true,
      },
    });
    this.logger.log(`Saved Bill.com vendorId=${vendorId} for user=${userId}`);
    return { saved: true };
  }

  /**
   * Test Bill.com API connection (login only). Does not require funding account ID.
   */
  async testBillConnection(): Promise<{ success: true; organizationId: string }> {
    return this.billService.testConnection();
  }

  /**
   * Create Bill.com vendor for user (with bank details)
   */
  async createConnectAccount(
    userId: string,
    vendorDto?: CreateVendorDto,
  ): Promise<CreateConnectAccountResponseDto> {
    this.logger.log(`Creating Bill.com vendor for user: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.billVendorId) {
      this.logger.log(`User already has Bill.com vendor: ${user.billVendorId}`);
      return {
        accountId: user.billVendorId,
        onboardingUrl: `${this.frontendUrl}/settings/payments`,
        accountStatus: user.billVendorStatus ?? 'active',
      };
    }

    if (!vendorDto?.payeeName) {
      return {
        accountId: '',
        onboardingUrl: `${this.frontendUrl}/settings/payments`,
        accountStatus: 'onboarding_incomplete',
      };
    }

    const addressLine1 = vendorDto.addressLine1 || '';
    const city = vendorDto.city || (user as Record<string, unknown>).city as string || '';
    const stateOrProvince = vendorDto.state || (user as Record<string, unknown>).state as string || '';
    const zipOrPostalCode = vendorDto.zipCode || (user as Record<string, unknown>).zipCode as string || '';

    if (!addressLine1 || !city || !zipOrPostalCode) {
      throw new BadRequestException(
        'Address details (line1, city, zip) are required to create a US vendor account.',
      );
    }

    const vendor = await this.billService.createVendor({
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      address: {
        line1: addressLine1,
        city,
        stateOrProvince,
        zipOrPostalCode,
      },
      ...(vendorDto.bankAccount && {
        paymentInformation: {
          payeeName: vendorDto.payeeName,
          bankAccount: vendorDto.bankAccount,
        },
      }),
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        billVendorId: vendor.id,
        billVendorStatus: 'active',
        paymentEnabled: true,
        w9Submitted: true,
        w9SubmittedAt: new Date(),
      },
    });

    return {
      accountId: vendor.id,
      onboardingUrl: `${this.frontendUrl}/settings/payments`,
      accountStatus: 'active',
    };
  }

  /**
   * Get payment settings URL (Bill.com - no external onboarding link)
   */
  async createAccountLink(userId: string): Promise<AccountLinkResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.billVendorId) {
      throw new BadRequestException('User does not have a Bill.com vendor account');
    }

    return {
      url: `${this.frontendUrl}/settings/payments`,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  /**
   * Get user's payment account status
   */
  async getAccountStatus(userId: string): Promise<AccountStatusDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        billVendorId: true,
        billVendorStatus: true,
        paymentEnabled: true,
        w9Submitted: true,
        w9SubmittedAt: true,
        totalEarnings: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.billVendorId) {
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

    try {
      const vendor = await this.billService.getVendor(user.billVendorId);
      return {
        hasAccount: true,
        accountId: user.billVendorId,
        accountStatus: user.billVendorStatus ?? undefined,
        paymentEnabled: user.paymentEnabled,
        w9Submitted: user.w9Submitted,
        w9SubmittedAt: user.w9SubmittedAt?.toISOString(),
        totalEarnings: user.totalEarnings / 100,
        chargesEnabled: true,
        payoutsEnabled: user.paymentEnabled,
        detailsSubmitted: !!vendor,
      };
    } catch {
      return {
        hasAccount: true,
        accountId: user.billVendorId,
        accountStatus: user.billVendorStatus ?? undefined,
        paymentEnabled: user.paymentEnabled,
        w9Submitted: user.w9Submitted,
        w9SubmittedAt: user.w9SubmittedAt?.toISOString(),
        totalEarnings: user.totalEarnings / 100,
        chargesEnabled: false,
        payoutsEnabled: user.paymentEnabled,
        detailsSubmitted: false,
      };
    }
  }

  /**
   * List pending payments (admin only). Used for admin "Pay now" flow.
   */
  async getPendingPayments() {
    const payments = await this.prisma.payment.findMany({
      where: { status: 'PENDING' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, billVendorId: true } },
        program: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return payments;
  }

  /**
   * Pay a specific PENDING payment via Bill.com (admin only). "Pay now" button flow.
   * Checks W9 before paying; sends email notification if HCP must complete setup.
   */
  async payNow(paymentId: string): Promise<PayoutResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== 'PENDING') {
      throw new BadRequestException(`Payment is not pending (status: ${payment.status})`);
    }

    const user = payment.user;
    const amountDollars = (payment.amount / 100).toFixed(2);

    if (!user.billVendorId) {
      this.logger.warn(`Pay now blocked: user ${user.id} has no Bill.com vendor`);
      await this.queueService.sendEmail(
        user.email,
        'Add bank details to receive your payout',
        `You have a pending payout of $${amountDollars} waiting. Please add your bank details at ${this.frontendUrl}/app/payments to receive payment.`,
      );
      throw new BadRequestException(
        'HCP has not added bank details. Notification sent to complete setup before getting paid.',
      );
    }

    if (!user.w9Submitted) {
      this.logger.warn(`Pay now blocked: user ${user.id} has not completed W9`);
      await this.queueService.sendEmail(
        user.email,
        'Complete W-9 to receive your payout',
        `You have a pending payout of $${amountDollars} waiting. Please complete your W-9 at ${this.frontendUrl}/app/payments before we can process your payment.`,
      );
      throw new BadRequestException(
        'HCP has not completed W-9. Notification sent to complete before getting paid.',
      );
    }

    try {
      const billPayment = await this.billService.createPayment(
        user.billVendorId,
        payment.amount,
        payment.description || `${payment.type} payment`,
      );

      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'PAID',
          billPaymentId: billPayment.id,
          paidAt: new Date(),
        },
      });

      await this.prisma.user.update({
        where: { id: payment.userId },
        data: { totalEarnings: { increment: payment.amount } },
      });

      this.logger.log(`Pay now successful: ${paymentId} -> Bill.com ${billPayment.id}`);

      return {
        paymentId: payment.id,
        amount: payment.amount,
        status: 'PAID',
        transferId: billPayment.id,
      };
    } catch (error) {
      this.logger.error(`Pay now failed: ${error.message}`);

      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: error.message,
        },
      });

      throw new BadRequestException(`Pay now failed: ${error.message}`);
    }
  }

  /**
   * Create payout to user via Bill.com (admin only).
   * Admins decide who gets paid, choose ACH or check in Bill.com, and verify W-9 before paying.
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

    if (!user.billVendorId) {
      throw new BadRequestException('User does not have a Bill.com vendor account');
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
      const billPayment = await this.billService.createPayment(
        user.billVendorId,
        dto.amount,
        dto.description || 'Honorarium payment',
      );

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          billPaymentId: billPayment.id,
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
        transferId: billPayment.id,
      };
    } catch (error) {
      this.logger.error(`Payout failed: ${error.message}`);

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
   * Get payment summary for user (available balance, pending, lifetime earnings)
   */
  async getSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { billVendorId: true, totalEarnings: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const paid = payments.filter((p) => p.status === 'PAID');
    const pending = payments.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING');
    const availableBalance = paid.reduce((s, p) => s + p.amount, 0) / 100;
    const pendingBalance = pending.reduce((s, p) => s + p.amount, 0) / 100;
    const lifetimeEarnings = (user.totalEarnings || 0) / 100;
    const lastPaid = paid[0];
    const lastPayoutDate = lastPaid?.paidAt?.toISOString() ?? null;

    return {
      availableBalance,
      pendingBalance,
      lifetimeEarnings,
      lastPayoutDate,
      billConnected: !!user.billVendorId,
      billVendorId: user.billVendorId,
    };
  }

  /**
   * Get payment history for user
   */
  async getHistory(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      include: { program: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return payments.map((p) => ({
      id: p.id,
      date: (p.paidAt || p.createdAt).toISOString(),
      title: p.description || p.program?.title || p.type.replace(/_/g, ' '),
      amount: p.amount / 100,
      status: p.status,
      method: 'Bill.com',
    }));
  }

  /**
   * Sync account status from Bill.com
   */
  async syncAccountStatus(userId: string) {
    this.logger.log(`Syncing account status for user: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.billVendorId) {
      throw new NotFoundException('User does not have a Bill.com vendor account');
    }

    try {
      const vendor = await this.billService.getVendor(user.billVendorId);
      const status = vendor ? 'active' : 'onboarding_incomplete';
      const paymentEnabled = !!vendor;

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          billVendorStatus: status,
          paymentEnabled,
          w9Submitted: paymentEnabled,
          w9SubmittedAt: paymentEnabled && !user.w9SubmittedAt ? new Date() : user.w9SubmittedAt,
        },
      });

      this.logger.log(`Synced user ${userId}: status=${status}, paymentEnabled=${paymentEnabled}`);

      return {
        userId,
        billVendorId: user.billVendorId,
        previousStatus: user.billVendorStatus,
        newStatus: status,
        paymentEnabled,
        w9Submitted: paymentEnabled,
      };
    } catch (error) {
      this.logger.error(`Sync failed: ${error.message}`);
      throw new BadRequestException(`Sync failed: ${error.message}`);
    }
  }
}
