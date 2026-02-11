import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BillService } from './bill.service';
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
  ) {
    this.frontendUrl = this.configService.get<string>('frontendUrl') || 'http://localhost:3000';
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

    if (!vendorDto?.payeeName || !vendorDto?.bankAccount) {
      return {
        accountId: '',
        onboardingUrl: `${this.frontendUrl}/settings/payments`,
        accountStatus: 'onboarding_incomplete',
      };
    }

    const vendor = await this.billService.createVendor({
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      accountType: 'PERSON',
      address: vendorDto.addressLine1
        ? {
            line1: vendorDto.addressLine1,
            city: vendorDto.city || 'TBD',
            stateOrProvince: vendorDto.state || 'CA',
            zipOrPostalCode: vendorDto.zipCode || '00000',
            country: 'US',
          }
        : undefined,
      paymentInformation: {
        payeeName: vendorDto.payeeName,
        bankAccount: vendorDto.bankAccount,
      },
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
    if (!user.billVendorId) {
      throw new BadRequestException('User does not have a Bill.com vendor account');
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
