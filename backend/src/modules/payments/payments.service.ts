import { randomUUID } from 'crypto';
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Prisma,
  PostEventAttendanceStatus,
  ProgramZoomSessionType,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BillService } from './bill.service';
import {
  CreateConnectAccountResponseDto,
  AccountLinkResponseDto,
} from './dto/create-connect-account.dto';
import { CreatePayoutDto, PayoutResponseDto } from './dto/create-payout.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { AccountStatusDto } from './dto/account-status.dto';
import { validateTaxId, sanitizeCompanyName } from './w9-validation';
import { assertProfileCompleteForPayments } from '../../common/profile-payment-eligibility';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private billService: BillService,
    private configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>('frontendUrl') || 'http://localhost:3000';
  }

  /**
   * Learner-facing payout summary for a program honorarium (masked bank + partial address only).
   */
  async getHonorariumProgramPreview(
    userId: string,
    programId: string,
  ): Promise<{
    programTitle: string;
    honorariumAmountCents: number;
    payeeDisplayName: string;
    maskedBankLast4: string | null;
    addressSummary: string | null;
    hasBillVendor: boolean;
    w9Submitted: boolean;
  }> {
    const [user, program] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          city: true,
          state: true,
          zipCode: true,
          billVendorId: true,
          w9Submitted: true,
          specialty: true,
          npiNumber: true,
        },
      }),
      this.prisma.program.findUnique({
        where: { id: programId },
        select: { title: true, honorariumAmount: true, zoomSessionType: true },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    assertProfileCompleteForPayments(user);
    if (!program) throw new NotFoundException('Program not found');
    if (!program.honorariumAmount || program.honorariumAmount <= 0) {
      throw new BadRequestException(
        'This program does not offer an honorarium',
      );
    }
    if (
      program.zoomSessionType !== ProgramZoomSessionType.WEBINAR &&
      program.zoomSessionType !== ProgramZoomSessionType.MEETING
    ) {
      throw new BadRequestException(
        'Honorarium preview is only available for LIVE programs',
      );
    }

    const payeeDisplayName = `${user.firstName} ${user.lastName}`.trim();
    const zip = user.zipCode?.replace(/\D/g, '') ?? '';
    const zipTail = zip.length >= 4 ? zip.slice(-4) : zip ? '••••' : null;
    const addressSummary =
      user.city || user.state || zipTail
        ? [user.city, user.state, zipTail ? `ZIP …${zipTail}` : null]
            .filter(Boolean)
            .join(', ')
        : null;

    let maskedBankLast4: string | null = null;
    if (user.billVendorId) {
      try {
        const raw = await this.billService.getVendorJson(user.billVendorId);
        maskedBankLast4 = this.extractMaskedBankLast4(raw);
      } catch (e) {
        this.logger.warn(
          `Bill.com vendor read for preview failed: ${(e as Error).message}`,
        );
      }
    }

    return {
      programTitle: program.title,
      honorariumAmountCents: program.honorariumAmount,
      payeeDisplayName,
      maskedBankLast4,
      addressSummary,
      hasBillVendor: !!user.billVendorId,
      w9Submitted: user.w9Submitted,
    };
  }

  private extractMaskedBankLast4(
    vendor: Record<string, unknown>,
  ): string | null {
    const tryFrom = (val: unknown): string | null => {
      if (val == null) return null;
      const s = String(val).replace(/\s/g, '');
      if (!s) return null;
      const digits = s.replace(/\D/g, '');
      if (digits.length >= 4) return digits.slice(-4);
      if (/\*{2,}/.test(s) && digits.length > 0) return digits.slice(-4);
      if (s.length <= 6 && digits.length > 0) return digits;
      return null;
    };

    const payInfo = vendor.paymentInformation as
      | Record<string, unknown>
      | undefined;
    const bank = payInfo?.bankAccount as Record<string, unknown> | undefined;
    const direct =
      tryFrom(bank?.accountNumber) ??
      tryFrom(bank?.accountNumberLast4) ??
      tryFrom(bank?.last4) ??
      tryFrom(vendor.accountNumber);

    if (direct) return `••••${direct}`;

    const nested = JSON.stringify(vendor);
    const m =
      nested.match(/accountNumber"\s*:\s*"([^"]+)"/i) ||
      nested.match(/last4"\s*:\s*"([^"]+)"/i);
    if (m?.[1]) {
      const t = tryFrom(m[1]);
      if (t) return `••••${t}`;
    }
    return null;
  }

  /**
   * Save Bill.com vendorId after frontend Elements SDK vendorSetupSuccess event.
   */
  async saveVendorId(
    userId: string,
    vendorId: string,
  ): Promise<{ saved: boolean }> {
    if (!vendorId?.trim())
      throw new BadRequestException('vendorId is required');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { specialty: true, npiNumber: true },
    });
    if (!user) throw new NotFoundException('User not found');
    assertProfileCompleteForPayments(user);
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
  async testBillConnection(): Promise<{
    success: true;
    organizationId: string;
  }> {
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

    if (!vendorDto?.payeeName) {
      if (user.billVendorId) {
        this.logger.log(
          `User already has Bill.com vendor: ${user.billVendorId}`,
        );
        return {
          accountId: user.billVendorId,
          onboardingUrl: `${this.frontendUrl}/settings/payments`,
          accountStatus: user.billVendorStatus ?? 'active',
        };
      }
      return {
        accountId: '',
        onboardingUrl: `${this.frontendUrl}/settings/payments`,
        accountStatus: 'onboarding_incomplete',
      };
    }

    assertProfileCompleteForPayments(user);

    const addressLine1 = vendorDto.addressLine1 || '';
    const city =
      vendorDto.city ||
      ((user as Record<string, unknown>).city as string) ||
      '';
    const stateOrProvince =
      vendorDto.state ||
      ((user as Record<string, unknown>).state as string) ||
      '';
    const zipOrPostalCode =
      vendorDto.zipCode ||
      ((user as Record<string, unknown>).zipCode as string) ||
      '';

    if (!addressLine1 || !city || !zipOrPostalCode) {
      throw new BadRequestException(
        'Address details (line1, city, zip) are required to create a US vendor account.',
      );
    }

    const vendorInput = {
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
    };

    if (user.billVendorId) {
      if (!vendorDto.bankAccount) {
        throw new BadRequestException(
          'Bank account details are required to update payment information.',
        );
      }
      this.logger.log(`Updating Bill.com vendor for user: ${userId}`);
      await this.billService.updateVendorPaymentAndAddress(
        user.billVendorId,
        vendorInput,
      );
      return {
        accountId: user.billVendorId,
        onboardingUrl: `${this.frontendUrl}/settings/payments`,
        accountStatus: user.billVendorStatus ?? 'active',
      };
    }

    const vendor = await this.billService.createVendor(vendorInput);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        billVendorId: vendor.id,
        billVendorStatus: 'active',
        paymentEnabled: true,
        // W-9 is submitted separately via the embedded W9Modal
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
      throw new BadRequestException(
        'User does not have a Bill.com vendor account',
      );
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
   * Delete a payment by ID (admin/dev only). For removing test entries.
   */
  async deletePaymentById(paymentId: string): Promise<{ deleted: boolean }> {
    const result = await this.prisma.payment.deleteMany({
      where: { id: paymentId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Payment not found');
    }
    this.logger.log(`Deleted payment ${paymentId}`);
    return { deleted: true };
  }

  /**
   * Delete payments by userId and optional programId (admin/dev only). For cleaning up test entries.
   * If programId omitted, deletes all payments for the user.
   */
  async deleteByUserAndProgram(
    userId: string,
    programId?: string,
  ): Promise<{ deleted: number }> {
    if (!userId?.trim()) {
      throw new BadRequestException('userId is required');
    }
    const where: { userId: string; programId?: string } = {
      userId: userId.trim(),
    };
    if (programId?.trim()) {
      where.programId = programId.trim();
    }
    const result = await this.prisma.payment.deleteMany({ where });
    this.logger.log(
      `Deleted ${result.count} payment(s) for userId=${userId}${programId ? ` programId=${programId}` : ''}`,
    );
    return { deleted: result.count };
  }

  /**
   * List pending payments (admin only). Used for admin "Pay now" flow.
   */
  async getPendingPayments() {
    const payments = await this.prisma.payment.findMany({
      where: { status: 'PENDING' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            billVendorId: true,
          },
        },
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

    if (payment.status === 'PAID') {
      throw new BadRequestException('Payment already completed');
    }
    if (payment.status === 'PROCESSING') {
      throw new ConflictException(
        'Payment is already being processed. Refresh and try again.',
      );
    }
    if (payment.status !== 'PENDING') {
      throw new BadRequestException(
        `Payment is not pending (status: ${payment.status})`,
      );
    }

    const user = payment.user;

    // For honorarium payments tied to a program, enforce the eligibility contract:
    // attendance must be VERIFIED (or NOT_REQUIRED) AND the survey must be acknowledged.
    if (payment.type === 'HONORARIUM' && payment.programId) {
      const reg = await this.prisma.programRegistration.findUnique({
        where: {
          userId_programId: {
            userId: payment.userId,
            programId: payment.programId,
          },
        },
        include: { program: { select: { jotformSurveyUrl: true } } },
      });

      if (!reg) {
        throw new ForbiddenException(
          'No matching registration found for this honorarium payment.',
        );
      }

      const attendanceOk =
        reg.postEventAttendanceStatus === PostEventAttendanceStatus.VERIFIED ||
        reg.postEventAttendanceStatus ===
          PostEventAttendanceStatus.NOT_REQUIRED;

      if (reg.postEventAttendanceStatus === PostEventAttendanceStatus.DENIED) {
        throw new ForbiddenException(
          `Cannot pay: attendance was denied for ${user.id} on program ${payment.programId}.`,
        );
      }
      if (!attendanceOk) {
        throw new ForbiddenException(
          `Cannot pay: attendance has not been verified for ${user.id} on program ${payment.programId}.`,
        );
      }

      if (
        reg.program.jotformSurveyUrl?.trim() &&
        !reg.postEventSurveyAcknowledgedAt
      ) {
        throw new ForbiddenException(
          `Cannot pay: post-event survey has not been acknowledged for ${user.id} on program ${payment.programId}.`,
        );
      }
    }

    if (!user.billVendorId) {
      this.logger.warn(
        `Pay now blocked: user ${user.id} has no Bill.com vendor`,
      );
      throw new BadRequestException(
        'HCP has not added bank details. Notification sent to complete setup before getting paid.',
      );
    }

    if (!user.w9Submitted) {
      this.logger.warn(`Pay now blocked: user ${user.id} has not completed W9`);
      throw new BadRequestException(
        'HCP has not completed W-9. Notification sent to complete before getting paid.',
      );
    }

    const locked = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });

    if (locked.count !== 1) {
      throw new ConflictException(
        'Could not start payment (another request may have started it). Refresh and try again.',
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

      this.logger.log(
        `Pay now successful: ${paymentId} -> Bill.com ${billPayment.id}`,
      );

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
   * Pass `idempotencyKey` (or reuse the same key on retry) for safe deduplication; omit only if double-submit protection is unnecessary.
   */
  async createPayout(dto: CreatePayoutDto): Promise<PayoutResponseDto> {
    this.logger.log(
      `Creating payout for user ${dto.userId}: $${dto.amount / 100}`,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.paymentEnabled) {
      throw new BadRequestException(
        'User is not enabled for payments. Complete onboarding first.',
      );
    }

    if (!user.billVendorId) {
      throw new BadRequestException(
        'User does not have a Bill.com vendor account',
      );
    }

    // Enforce eligibility contract for honorarium payouts linked to a program.
    if (dto.programId) {
      const reg = await this.prisma.programRegistration.findUnique({
        where: {
          userId_programId: { userId: dto.userId, programId: dto.programId },
        },
        include: { program: { select: { jotformSurveyUrl: true } } },
      });

      if (!reg) {
        throw new ForbiddenException(
          'No matching registration found for this program payout.',
        );
      }

      const attendanceOk =
        reg.postEventAttendanceStatus === PostEventAttendanceStatus.VERIFIED ||
        reg.postEventAttendanceStatus ===
          PostEventAttendanceStatus.NOT_REQUIRED;

      if (reg.postEventAttendanceStatus === PostEventAttendanceStatus.DENIED) {
        throw new ForbiddenException(
          `Cannot pay: attendance was denied for ${dto.userId} on program ${dto.programId}.`,
        );
      }
      if (!attendanceOk) {
        throw new ForbiddenException(
          `Cannot pay: attendance has not been verified for ${dto.userId} on program ${dto.programId}.`,
        );
      }

      if (
        reg.program.jotformSurveyUrl?.trim() &&
        !reg.postEventSurveyAcknowledgedAt
      ) {
        throw new ForbiddenException(
          `Cannot pay: post-event survey has not been acknowledged for ${dto.userId} on program ${dto.programId}.`,
        );
      }
    }

    const rawKey = dto.idempotencyKey?.trim();
    const idempotencyKey = (rawKey || `admin_payout:${randomUUID()}`).slice(
      0,
      200,
    );

    const existingByKey = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existingByKey) {
      if (existingByKey.status === 'PAID' && existingByKey.billPaymentId) {
        this.logger.log(
          `createPayout idempotent replay key=${idempotencyKey} payment=${existingByKey.id}`,
        );
        return {
          paymentId: existingByKey.id,
          amount: existingByKey.amount,
          status: 'PAID',
          transferId: existingByKey.billPaymentId,
        };
      }
      if (existingByKey.status === 'PROCESSING') {
        throw new ConflictException(
          'This payout idempotency key is already being processed.',
        );
      }
      if (existingByKey.status === 'PENDING') {
        throw new ConflictException(
          'A payout with this idempotency key is already pending. Wait for it to finish or use a new key.',
        );
      }
      throw new BadRequestException(
        'A payout with this idempotency key previously failed. Retry with a new idempotency key.',
      );
    }

    let payment;
    try {
      payment = await this.prisma.payment.create({
        data: {
          userId: dto.userId,
          programId: dto.programId,
          amount: dto.amount,
          type: 'HONORARIUM',
          status: 'PENDING',
          description: dto.description,
          idempotencyKey,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const lostRace = await this.prisma.payment.findUnique({
          where: { idempotencyKey },
        });
        if (lostRace?.status === 'PAID' && lostRace.billPaymentId) {
          return {
            paymentId: lostRace.id,
            amount: lostRace.amount,
            status: 'PAID',
            transferId: lostRace.billPaymentId,
          };
        }
        throw new ConflictException(
          'Duplicate payout request (idempotency key collision). Try again.',
        );
      }
      throw e;
    }

    const locked = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });
    if (locked.count !== 1) {
      throw new ConflictException('Could not start payout processing.');
    }

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
          failureReason: (error as Error).message,
        },
      });

      throw new BadRequestException(
        `Payout failed: ${(error as Error).message}`,
      );
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
    const pending = payments.filter(
      (p) => p.status === 'PENDING' || p.status === 'PROCESSING',
    );
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
   * Submit W-9 tax information to Bill.com vendor
   */
  async submitW9(
    userId: string,
    data: { taxId: string; taxIdType: 'SSN' | 'EIN'; companyName?: string },
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        billVendorId: true,
        specialty: true,
        npiNumber: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    assertProfileCompleteForPayments(user);
    if (!user.billVendorId)
      throw new BadRequestException(
        'Add bank details first before submitting W-9',
      );

    const taxId = data.taxId.replace(/\D/g, '');
    const validation = validateTaxId(taxId, data.taxIdType);
    if (!validation.valid) {
      throw new BadRequestException(
        validation.error || 'Invalid tax ID format',
      );
    }

    const companyName = sanitizeCompanyName(data.companyName);

    await this.billService.updateVendorTaxInfo(user.billVendorId, {
      taxId,
      taxIdType: data.taxIdType,
      companyName,
      track1099: true,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        w9Submitted: true,
        w9SubmittedAt: new Date(),
      },
    });

    this.logger.log(`W-9 submitted for user ${userId}`);
    return { success: true };
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
      throw new NotFoundException(
        'User does not have a Bill.com vendor account',
      );
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
          w9SubmittedAt:
            paymentEnabled && !user.w9SubmittedAt
              ? new Date()
              : user.w9SubmittedAt,
        },
      });

      this.logger.log(
        `Synced user ${userId}: status=${status}, paymentEnabled=${paymentEnabled}`,
      );

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
