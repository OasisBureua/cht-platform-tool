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
import { StripeService } from './stripe.service';
import {
  CreateConnectAccountResponseDto,
  AccountLinkResponseDto,
} from './dto/create-connect-account.dto';
import { CreatePayoutDto, PayoutResponseDto } from './dto/create-payout.dto';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { AccountStatusDto } from './dto/account-status.dto';
import { validateTaxId, sanitizeCompanyName } from './w9-validation';
import { assertProfileCompleteForPayments } from '../../common/profile-payment-eligibility';
import { programHasPostEventSurvey } from '../../utils/program-survey-config';
import { summarizeBillError } from './bill-process-date';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private billService: BillService,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>('frontendUrl') || 'http://localhost:3000';
  }

  /** When Stripe is configured, Bill is not used on the payments happy path. */
  private useStripe(): boolean {
    return this.stripeService.isConfigured();
  }

  private assertStripeNotRequiredBillPath(): void {
    if (this.useStripe()) {
      throw new BadRequestException(
        'This environment uses Stripe Connect. Use Account Link / Stripe onboarding instead of Bill.com.',
      );
    }
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
          stripeAccountId: true,
          stripePayoutsEnabled: true,
          bankAccountLast4: true,
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

    let maskedBankLast4: string | null = user.bankAccountLast4 ?? null;
    if (!maskedBankLast4 && user.billVendorId && !this.useStripe()) {
      try {
        const raw = await this.billService.getVendorJson(user.billVendorId);
        maskedBankLast4 = this.extractMaskedBankLast4(raw);
      } catch (e) {
        this.logger.warn(
          `Bill.com vendor read for preview failed: ${(e as Error).message}`,
        );
      }
    }

    const hasPayoutAccount = this.useStripe()
      ? !!user.stripeAccountId
      : !!user.billVendorId;

    return {
      programTitle: program.title,
      honorariumAmountCents: program.honorariumAmount,
      payeeDisplayName,
      maskedBankLast4,
      addressSummary,
      /** Legacy field name — true when Stripe Connect or Bill vendor is linked. */
      hasBillVendor: hasPayoutAccount,
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
    this.assertStripeNotRequiredBillPath();
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
    this.assertStripeNotRequiredBillPath();
    return this.billService.testConnection();
  }

  /**
   * Create Stripe Express account (or Bill.com vendor when Stripe is not configured).
   */
  async createConnectAccount(
    userId: string,
    vendorDto?: CreateVendorDto,
  ): Promise<CreateConnectAccountResponseDto> {
    if (this.useStripe()) {
      return this.createStripeConnectAccount(userId);
    }
    return this.createBillConnectAccount(userId, vendorDto);
  }

  /** Ensure a Stripe Connect recipient account exists; does not create Account Links. */
  private async ensureStripeAccountId(userId: string): Promise<{
    accountId: string;
    accountStatus: string;
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    assertProfileCompleteForPayments(user);

    let accountId = user.stripeAccountId;
    if (!accountId) {
      this.logger.log(`Creating Stripe Express account for user: ${userId}`);
      const account = await this.stripeService.createExpressAccount({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userId: user.id,
      });
      accountId = account.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          stripeAccountId: accountId,
          stripeAccountStatus: 'onboarding_incomplete',
          preferredPaymentMethod: 'ACH',
        },
      });
    }

    return {
      accountId,
      accountStatus: user.stripeAccountStatus ?? 'onboarding_incomplete',
    };
  }

  private async createStripeConnectAccount(
    userId: string,
  ): Promise<CreateConnectAccountResponseDto> {
    const { accountId, accountStatus } =
      await this.ensureStripeAccountId(userId);

    const refreshUrl = `${this.frontendUrl}/settings?tab=payment&stripe=refresh`;
    const returnUrl = `${this.frontendUrl}/settings?tab=payment&stripe=return`;
    const link = await this.stripeService.createAccountLink(accountId, {
      refreshUrl,
      returnUrl,
    });

    return {
      accountId,
      onboardingUrl: link.url,
      accountStatus,
    };
  }

  /**
   * Account Session client_secret for Connect Embedded onboarding (Settings UI).
   */
  async createStripeAccountSession(userId: string): Promise<{
    clientSecret: string;
    publishableKey: string;
    accountId: string;
    expiresAt: number;
  }> {
    if (!this.useStripe()) {
      throw new BadRequestException(
        'Stripe is not configured in this environment.',
      );
    }
    const { accountId } = await this.ensureStripeAccountId(userId);
    const session = await this.stripeService.createAccountSession(accountId);
    const publishableKey = this.stripeService.getPublishableKey();
    if (!publishableKey) {
      throw new BadRequestException(
        'STRIPE_PUBLISHABLE_KEY is not configured.',
      );
    }
    return {
      clientSecret: session.clientSecret,
      publishableKey,
      accountId,
      expiresAt: session.expiresAt,
    };
  }

  private async createBillConnectAccount(
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

    const paymentMethod = vendorDto.paymentMethod;
    if (paymentMethod !== 'ACH' && paymentMethod !== 'CHECK') {
      throw new BadRequestException(
        'Select a payment method: ACH or Check.',
      );
    }

    if (paymentMethod === 'ACH' && !vendorDto.bankAccount) {
      throw new BadRequestException(
        'Bank account details are required for ACH payouts.',
      );
    }

    const bankLast4 =
      paymentMethod === 'ACH' && vendorDto.bankAccount?.accountNumber
        ? vendorDto.bankAccount.accountNumber.replace(/\D/g, '').slice(-4)
        : null;

    const vendorInput = {
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      paymentMethod,
      address: {
        line1: addressLine1,
        city,
        stateOrProvince,
        zipOrPostalCode,
      },
      ...(paymentMethod === 'ACH' && vendorDto.bankAccount
        ? {
            paymentInformation: {
              payeeName: vendorDto.payeeName,
              bankAccount: vendorDto.bankAccount,
            },
          }
        : {
            paymentInformation: {
              payeeName: vendorDto.payeeName,
            },
          }),
    };

    if (user.billVendorId) {
      this.logger.log(
        `Updating Bill.com vendor for user: ${userId} method=${paymentMethod}`,
      );
      await this.billService.updateVendorPaymentAndAddress(
        user.billVendorId,
        vendorInput,
      );
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          preferredPaymentMethod: paymentMethod,
          bankAccountLast4: paymentMethod === 'ACH' ? bankLast4 : null,
          paymentEnabled: true,
          billVendorStatus: user.billVendorStatus ?? 'active',
        },
      });
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
        preferredPaymentMethod: paymentMethod,
        bankAccountLast4: paymentMethod === 'ACH' ? bankLast4 : null,
      },
    });

    return {
      accountId: vendor.id,
      onboardingUrl: `${this.frontendUrl}/settings/payments`,
      accountStatus: 'active',
    };
  }

  /**
   * Stripe Account Link (Express onboarding) or Bill settings URL.
   */
  async createAccountLink(userId: string): Promise<AccountLinkResponseDto> {
    if (this.useStripe()) {
      const created = await this.createStripeConnectAccount(userId);
      return {
        url: created.onboardingUrl,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };
    }

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
   * Get user's payment account status (Stripe when configured).
   */
  async getAccountStatus(userId: string): Promise<AccountStatusDto> {
    if (this.useStripe()) {
      return this.getStripeAccountStatus(userId);
    }
    return this.getBillAccountStatus(userId);
  }

  private async getStripeAccountStatus(
    userId: string,
  ): Promise<AccountStatusDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeAccountId: true,
        stripeAccountStatus: true,
        stripePayoutsEnabled: true,
        paymentEnabled: true,
        w9Submitted: true,
        w9SubmittedAt: true,
        totalEarnings: true,
        preferredPaymentMethod: true,
        bankAccountLast4: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    if (!user.stripeAccountId) {
      return {
        hasAccount: false,
        paymentEnabled: false,
        w9Submitted: false,
        totalEarnings: user.totalEarnings / 100,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        usesStripeConnect: true,
        preferredPaymentMethod: 'ACH',
        bankAccountLast4: user.bankAccountLast4 ?? null,
      };
    }

    try {
      const account = await this.stripeService.retrieveAccount(
        user.stripeAccountId,
      );
      const summary = this.stripeService.summarizeAccount(account);
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          stripeAccountStatus: summary.status,
          stripePayoutsEnabled: summary.payoutsEnabled,
          paymentEnabled: summary.payoutsEnabled && summary.taxComplete,
          preferredPaymentMethod: 'ACH',
          // PAY-4: w9Submitted mirrors Stripe taxComplete only (ignore legacy Bill W-9).
          w9Submitted: summary.taxComplete,
          w9SubmittedAt: summary.taxComplete
            ? (user.w9SubmittedAt ?? new Date())
            : null,
          ...(summary.bankAccountLast4
            ? { bankAccountLast4: summary.bankAccountLast4 }
            : {}),
          ...(summary.detailsSubmitted
            ? { stripeOnboardingCompleteAt: new Date() }
            : {}),
        },
      });
      return {
        hasAccount: true,
        accountId: user.stripeAccountId,
        accountStatus: summary.status,
        paymentEnabled: summary.payoutsEnabled && summary.taxComplete,
        w9Submitted: summary.taxComplete,
        w9SubmittedAt: summary.taxComplete
          ? (user.w9SubmittedAt ?? new Date()).toISOString()
          : undefined,
        totalEarnings: user.totalEarnings / 100,
        chargesEnabled: summary.chargesEnabled,
        payoutsEnabled: summary.payoutsEnabled,
        detailsSubmitted: summary.detailsSubmitted,
        usesStripeConnect: true,
        preferredPaymentMethod: 'ACH',
        bankAccountLast4:
          summary.bankAccountLast4 ?? user.bankAccountLast4 ?? null,
      };
    } catch (err) {
      this.logger.warn(
        `Stripe account status fallback for ${userId}: ${(err as Error).message}`,
      );
      return {
        hasAccount: true,
        accountId: user.stripeAccountId,
        accountStatus: user.stripeAccountStatus ?? undefined,
        paymentEnabled: user.paymentEnabled,
        w9Submitted: user.w9Submitted,
        w9SubmittedAt: user.w9SubmittedAt?.toISOString(),
        totalEarnings: user.totalEarnings / 100,
        chargesEnabled: false,
        payoutsEnabled: user.stripePayoutsEnabled,
        detailsSubmitted: !!user.stripeAccountId,
        usesStripeConnect: true,
        preferredPaymentMethod: 'ACH',
        bankAccountLast4: user.bankAccountLast4 ?? null,
      };
    }
  }

  private async getBillAccountStatus(
    userId: string,
  ): Promise<AccountStatusDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        billVendorId: true,
        billVendorStatus: true,
        paymentEnabled: true,
        w9Submitted: true,
        w9SubmittedAt: true,
        totalEarnings: true,
        preferredPaymentMethod: true,
        bankAccountLast4: true,
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
        usesStripeConnect: false,
        preferredPaymentMethod: user.preferredPaymentMethod ?? null,
        bankAccountLast4: user.bankAccountLast4 ?? null,
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
        usesStripeConnect: false,
        preferredPaymentMethod: user.preferredPaymentMethod ?? null,
        bankAccountLast4: user.bankAccountLast4 ?? null,
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
        usesStripeConnect: false,
        preferredPaymentMethod: user.preferredPaymentMethod ?? null,
        bankAccountLast4: user.bankAccountLast4 ?? null,
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
            stripeAccountId: true,
            stripePayoutsEnabled: true,
            w9Submitted: true,
            preferredPaymentMethod: true,
            bankAccountLast4: true,
          },
        },
        program: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return payments;
  }

  /**
   * Preview Pay-now eligibility for an admin manual honorarium tied to a program.
   * Used to warn before queueing when attendance / survey ack are incomplete.
   */
  async getManualHonorariumEligibility(userId: string, programId: string) {
    const uid = userId.trim();
    const pid = programId.trim();
    if (!uid || !pid) {
      throw new BadRequestException('userId and programId are required.');
    }

    const program = await this.prisma.program.findUnique({
      where: { id: pid },
      select: { id: true, title: true, jotformSurveyUrl: true },
    });
    if (!program) {
      throw new NotFoundException('Program not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: uid },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        billVendorId: true,
        stripeAccountId: true,
        stripePayoutsEnabled: true,
        w9Submitted: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const reg = await this.prisma.programRegistration.findUnique({
      where: { userId_programId: { userId: uid, programId: pid } },
      select: {
        postEventAttendanceStatus: true,
        postEventSurveyAcknowledgedAt: true,
      },
    });

    const warnings: string[] = [];
    if (!reg) {
      warnings.push('No registration found for this user on the selected program.');
    }

    const attendanceStatus = reg?.postEventAttendanceStatus ?? null;
    const attendanceOk =
      !!reg &&
      (reg.postEventAttendanceStatus === PostEventAttendanceStatus.VERIFIED ||
        reg.postEventAttendanceStatus ===
          PostEventAttendanceStatus.NOT_REQUIRED);

    if (reg?.postEventAttendanceStatus === PostEventAttendanceStatus.DENIED) {
      warnings.push('Attendance was denied for this registration.');
    } else if (reg && !attendanceOk) {
      warnings.push(
        `Attendance is not verified yet (status: ${reg.postEventAttendanceStatus}).`,
      );
    }

    const surveyRequired = await programHasPostEventSurvey(
      this.prisma,
      pid,
      program.jotformSurveyUrl,
    );
    const surveyAcknowledged = !!reg?.postEventSurveyAcknowledgedAt;
    if (surveyRequired && !surveyAcknowledged) {
      warnings.push('Post-event survey has not been acknowledged yet.');
    }

    const hasPayoutAccount = this.useStripe()
      ? !!user.stripeAccountId && !!user.stripePayoutsEnabled
      : !!user.billVendorId;
    const w9Submitted = !!user.w9Submitted;
    if (!hasPayoutAccount) {
      warnings.push(
        this.useStripe()
          ? 'HCP has not completed Stripe Connect ACH onboarding yet.'
          : 'HCP has not added Bill.com bank details yet.',
      );
    }
    if (!w9Submitted) {
      warnings.push(
        this.useStripe()
          ? 'Tax details are not complete on the Stripe Connect account yet.'
          : 'W-9 has not been submitted yet.',
      );
    }

    const programEligibilityOk =
      !!reg &&
      attendanceOk &&
      (!surveyRequired || surveyAcknowledged) &&
      reg.postEventAttendanceStatus !== PostEventAttendanceStatus.DENIED;

    const hasBillVendor = hasPayoutAccount;
    const payNowReady = programEligibilityOk && hasPayoutAccount && w9Submitted;

    return {
      userId: user.id,
      programId: program.id,
      programTitle: program.title,
      registrationFound: !!reg,
      attendanceStatus,
      attendanceOk,
      surveyRequired,
      surveyAcknowledged,
      hasBillVendor,
      w9Submitted,
      programEligibilityOk,
      payNowReady,
      warnings,
    };
  }

  /**
   * Create a PENDING payment for admin review (no immediate Bill.com payout).
   * Use for manual honorarium or bonus entries per user/program.
   */
  async createManualPendingPayment(dto: CreateManualPaymentDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId.trim() },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const programId = dto.programId?.trim() || null;
    if (programId) {
      const program = await this.prisma.program.findUnique({
        where: { id: programId },
        select: { id: true },
      });
      if (!program) {
        throw new NotFoundException('Program not found');
      }
    }

    const type = dto.type ?? 'HONORARIUM';
    const description =
      dto.description?.trim() ||
      (programId ? 'Manual program payment (admin)' : 'Manual payment (admin)');

    return this.prisma.payment.create({
      data: {
        userId: user.id,
        programId,
        amount: dto.amount,
        type,
        status: 'PENDING',
        description: description.slice(0, 500),
        idempotencyKey: `manual_pending:${randomUUID()}`.slice(0, 200),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            billVendorId: true,
            w9Submitted: true,
          },
        },
        program: { select: { id: true, title: true } },
      },
    });
  }

  async getFailedPayments() {
    const payments = await this.prisma.payment.findMany({
      where: { status: 'FAILED' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            billVendorId: true,
            stripeAccountId: true,
            stripePayoutsEnabled: true,
            w9Submitted: true,
            preferredPaymentMethod: true,
            bankAccountLast4: true,
          },
        },
        program: { select: { id: true, title: true } },
      },
      orderBy: { failedAt: 'desc' },
    });
    return payments;
  }

  /**
   * Recent successful payouts (admin payments page). Newest first; capped for performance.
   */
  async getPaidPaymentsForAdmin(limit = 200) {
    const take = Math.min(Math.max(Number(limit) || 200, 1), 500);
    return this.prisma.payment.findMany({
      where: { status: 'PAID' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            billVendorId: true,
            w9Submitted: true,
            preferredPaymentMethod: true,
            bankAccountLast4: true,
          },
        },
        program: { select: { id: true, title: true } },
      },
      orderBy: [{ paidAt: 'desc' }, { updatedAt: 'desc' }],
      take,
    });
  }

  /**
   * Admin CSV export of payments (pending / failed / paid / all) with optional date range.
   */
  async exportPaymentsCsv(opts: {
    status?: 'PENDING' | 'FAILED' | 'PAID' | 'ALL';
    from?: string;
    to?: string;
  }): Promise<string> {
    const statusFilter =
      opts.status && opts.status !== 'ALL'
        ? { status: opts.status }
        : undefined;

    const fromDate = opts.from ? new Date(opts.from) : null;
    const toDate = opts.to ? new Date(opts.to) : null;
    const createdAt =
      fromDate || toDate
        ? {
            ...(fromDate && !Number.isNaN(fromDate.getTime())
              ? { gte: fromDate }
              : {}),
            ...(toDate && !Number.isNaN(toDate.getTime())
              ? { lte: toDate }
              : {}),
          }
        : undefined;

    const rows = await this.prisma.payment.findMany({
      where: {
        ...statusFilter,
        ...(createdAt && Object.keys(createdAt).length
          ? { createdAt }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        program: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const escape = (value: unknown) => {
      const s = value == null ? '' : String(value);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = [
      'paymentId',
      'status',
      'amountCents',
      'amountDollars',
      'type',
      'userId',
      'userEmail',
      'userName',
      'programId',
      'programTitle',
      'createdAt',
      'paidAt',
      'failedAt',
      'billPaymentId',
    ].join(',');

    const lines = rows.map((p) =>
      [
        p.id,
        p.status,
        p.amount,
        (p.amount / 100).toFixed(2),
        p.type,
        p.userId,
        p.user?.email ?? '',
        `${p.user?.firstName ?? ''} ${p.user?.lastName ?? ''}`.trim(),
        p.programId ?? '',
        p.program?.title ?? '',
        p.createdAt?.toISOString?.() ?? '',
        p.paidAt?.toISOString?.() ?? '',
        p.failedAt?.toISOString?.() ?? '',
        p.billPaymentId ?? '',
      ]
        .map(escape)
        .join(','),
    );

    return [header, ...lines].join('\n');
  }

  /**
   * Reset a FAILED payment back to PENDING and immediately attempt payment via Bill.com (admin only).
   * Clears the previous failure metadata before delegating to the standard payNow flow.
   */
  async retryPayment(paymentId: string): Promise<PayoutResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    if (payment.status !== 'FAILED') {
      throw new BadRequestException(
        `Payment cannot be retried (status: ${payment.status}). Only FAILED payments can be retried.`,
      );
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'PENDING', failedAt: null, failureReason: null },
    });

    this.logger.log(`Retrying failed payment: ${paymentId}`);
    return this.payNow(paymentId);
  }

  /**
   * Pay a specific PENDING payment via Bill.com (admin only). "Pay now" button flow.
   * Checks Bill.com vendor + W9 before paying. Honoraria linked to a program also require
   * verified attendance / survey ack (including admin-queued manual rows).
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
    // (Includes admin-queued manual rows, Pay now still requires eligibility.)
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
        (await programHasPostEventSurvey(
          this.prisma,
          payment.programId!,
          reg.program.jotformSurveyUrl,
        )) &&
        !reg.postEventSurveyAcknowledgedAt
      ) {
        throw new ForbiddenException(
          `Cannot pay: post-event survey has not been acknowledged for ${user.id} on program ${payment.programId}.`,
        );
      }
    }

    if (this.useStripe()) {
      return this.payNowWithStripe(paymentId, payment, user);
    }

    if (!user.billVendorId) {
      this.logger.warn(
        `Pay now blocked: user ${user.id} has no Bill.com vendor`,
      );
      throw new BadRequestException(
        'HCP has not completed payment setup (ACH or check). Ask them to finish Settings → Payment, then try Pay now again.',
      );
    }

    if (!user.w9Submitted) {
      this.logger.warn(`Pay now blocked: user ${user.id} has not completed W9`);
      throw new BadRequestException(
        'HCP has not completed W-9. Ask them to submit W-9, then try Pay now again.',
      );
    }

    if (
      user.preferredPaymentMethod !== 'CHECK' &&
      user.preferredPaymentMethod !== 'ACH'
    ) {
      this.logger.warn(
        `Pay now blocked: user ${user.id} has no preferred payment method`,
      );
      throw new BadRequestException(
        'HCP has not chosen ACH or Check. Ask them to finish Settings → Payment, then try Pay now again.',
      );
    }

    const deliveryMethod = user.preferredPaymentMethod;

    // Bill.com pays by ACH when a vendor bank exists and by CHECK when it does not.
    // Heal CHECK (delete stale bank). For ACH, require bank already on file.
    try {
      if (deliveryMethod === 'CHECK') {
        await this.billService.syncVendorPaymentMethod(
          user.billVendorId,
          'CHECK',
        );
      } else {
        await this.billService.ensureVendorPaymentMethodMatches(
          user.billVendorId,
          'ACH',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Pay now blocked: Bill.com payment method mismatch for user ${user.id}: ${msg}`,
      );
      throw new BadRequestException(
        deliveryMethod === 'ACH'
          ? 'HCP selected ACH but Bill.com has no bank account on file. Ask them to re-save ACH details in Settings → Payment.'
          : 'Could not switch Bill.com vendor to Check. Ask the HCP to re-save Check as their payment method in Settings → Payment.',
      );
    }

    const locked = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: {
        status: 'PROCESSING',
        deliveryMethod,
        ...(deliveryMethod === 'CHECK'
          ? { checkStatus: 'PENDING_MAIL' }
          : { checkStatus: null }),
      },
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
          ...(deliveryMethod === 'CHECK'
            ? {
                checkStatus: 'SENT',
                checkMailedAt: new Date(),
              }
            : {}),
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
      const err = error as Error;
      this.logger.error(`Pay now failed: ${err.message}`);
      const summary = summarizeBillError(err);

      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: summary,
        },
      });

      throw new BadRequestException(`Pay now failed: ${summary}`);
    }
  }

  private async payNowWithStripe(
    paymentId: string,
    payment: {
      id: string;
      userId: string;
      amount: number;
      type: string;
      description: string | null;
    },
    user: {
      id: string;
      stripeAccountId: string | null;
      stripePayoutsEnabled: boolean;
      w9Submitted: boolean;
      paymentEnabled: boolean;
    },
  ): Promise<PayoutResponseDto> {
    if (!user.stripeAccountId) {
      throw new BadRequestException(
        'HCP has not completed Stripe Connect onboarding. Ask them to finish Settings → Payment, then try Pay now again.',
      );
    }

    const account = await this.stripeService.retrieveAccount(
      user.stripeAccountId,
    );
    const summary = this.stripeService.summarizeAccount(account);
    if (!summary.payoutsEnabled) {
      throw new BadRequestException(
        'HCP Stripe account cannot receive payouts yet. Ask them to finish Connect onboarding.',
      );
    }
    if (!summary.taxComplete) {
      throw new BadRequestException(
        'HCP has not completed tax / W-9 requirements in Stripe. Ask them to finish Connect onboarding, then try again.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        stripePayoutsEnabled: summary.payoutsEnabled,
        stripeAccountStatus: summary.status,
        paymentEnabled: true,
        preferredPaymentMethod: 'ACH',
        w9Submitted: true,
        w9SubmittedAt: new Date(),
        ...(summary.bankAccountLast4
          ? { bankAccountLast4: summary.bankAccountLast4 }
          : {}),
      },
    });

    const locked = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: {
        status: 'PROCESSING',
        deliveryMethod: 'ACH',
        checkStatus: null,
      },
    });
    if (locked.count !== 1) {
      throw new ConflictException(
        'Could not start payment (another request may have started it). Refresh and try again.',
      );
    }

    try {
      const transfer = await this.stripeService.createTransfer({
        amountCents: payment.amount,
        destinationAccountId: user.stripeAccountId,
        paymentId: payment.id,
        userId: payment.userId,
        description: payment.description || `${payment.type} payment`,
      });

      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'PAID',
          stripeTransferId: transfer.id,
          paidAt: new Date(),
          deliveryMethod: 'ACH',
        },
      });
      await this.prisma.user.update({
        where: { id: payment.userId },
        data: { totalEarnings: { increment: payment.amount } },
      });

      this.logger.log(
        `Pay now successful: ${paymentId} -> Stripe transfer ${transfer.id}`,
      );
      return {
        paymentId: payment.id,
        amount: payment.amount,
        status: 'PAID',
        transferId: transfer.id,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Pay now (Stripe) failed: ${err.message}`);
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: err.message.slice(0, 500),
        },
      });
      throw new BadRequestException(`Pay now failed: ${err.message}`);
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

    if (this.useStripe()) {
      if (!user.stripeAccountId || !user.stripePayoutsEnabled) {
        throw new BadRequestException(
          'User does not have an active Stripe Connect account ready for payouts.',
        );
      }
    } else {
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
        (await programHasPostEventSurvey(
          this.prisma,
          dto.programId,
          reg.program.jotformSurveyUrl,
        )) &&
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

    if (this.useStripe()) {
      try {
        const transfer = await this.stripeService.createTransfer({
          amountCents: dto.amount,
          destinationAccountId: user.stripeAccountId!,
          paymentId: payment.id,
          userId: dto.userId,
          description: dto.description || 'Honorarium payment',
        });
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            stripeTransferId: transfer.id,
            paidAt: new Date(),
            deliveryMethod: 'ACH',
          },
        });
        await this.prisma.user.update({
          where: { id: dto.userId },
          data: { totalEarnings: { increment: dto.amount } },
        });
        return {
          paymentId: payment.id,
          amount: dto.amount,
          status: 'PAID',
          transferId: transfer.id,
        };
      } catch (error) {
        const err = error as Error;
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: err.message.slice(0, 500),
          },
        });
        throw new BadRequestException(`Payout failed: ${err.message}`);
      }
    }

    const deliveryMethod =
      user.preferredPaymentMethod === 'CHECK' ||
      user.preferredPaymentMethod === 'ACH'
        ? user.preferredPaymentMethod
        : null;

    if (!deliveryMethod) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: 'HCP has not chosen ACH or Check',
        },
      });
      throw new BadRequestException(
        'HCP has not chosen ACH or Check. Ask them to finish Settings → Payment first.',
      );
    }

    try {
      if (deliveryMethod === 'CHECK') {
        await this.billService.syncVendorPaymentMethod(
          user.billVendorId!,
          'CHECK',
        );
      } else {
        await this.billService.ensureVendorPaymentMethodMatches(
          user.billVendorId!,
          'ACH',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: msg,
        },
      });
      throw new BadRequestException(
        deliveryMethod === 'ACH'
          ? 'HCP selected ACH but Bill.com has no bank account on file. Ask them to re-save ACH details in Settings → Payment.'
          : 'Could not switch Bill.com vendor to Check. Ask the HCP to re-save Check as their payment method in Settings → Payment.',
      );
    }

    try {
      const billPayment = await this.billService.createPayment(
        user.billVendorId!,
        dto.amount,
        dto.description || 'Honorarium payment',
      );

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          billPaymentId: billPayment.id,
          paidAt: new Date(),
          deliveryMethod,
          ...(deliveryMethod === 'CHECK'
            ? { checkStatus: 'SENT', checkMailedAt: new Date() }
            : {}),
        },
      });

      await this.prisma.user.update({
        where: { id: dto.userId },
        data: { totalEarnings: { increment: dto.amount } },
      });

      return {
        paymentId: payment.id,
        amount: dto.amount,
        status: 'PAID',
        transferId: billPayment.id,
      };
    } catch (error) {
      const err = error as Error;
      const summary = summarizeBillError(err);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: summary,
        },
      });
      throw new BadRequestException(`Payout failed: ${summary}`);
    }
  }

  /**
   * Get payment summary for user (available balance, pending, lifetime earnings)
   */
  async getSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        billVendorId: true,
        stripeAccountId: true,
        totalEarnings: true,
      },
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
      stripeConnected: !!user.stripeAccountId,
      stripeAccountId: user.stripeAccountId,
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
      method:
        p.deliveryMethod === 'CHECK'
          ? 'Check'
          : p.deliveryMethod === 'ACH'
            ? 'ACH'
            : p.stripeTransferId
              ? 'Stripe'
              : 'Bill.com',
      deliveryMethod: p.deliveryMethod ?? null,
      checkStatus: p.checkStatus ?? null,
      checkMailedAt: p.checkMailedAt?.toISOString() ?? null,
      checkDeliveredAt: p.checkDeliveredAt?.toISOString() ?? null,
      checkTrackingInfo: p.checkTrackingInfo ?? null,
    }));
  }

  async submitW9(
    userId: string,
    data: { taxId: string; taxIdType: 'SSN' | 'EIN'; companyName?: string },
  ): Promise<{ success: boolean; usesStripeConnect?: boolean }> {
    if (this.useStripe()) {
      // PAY-4: Bill vendor tax push is unused. TIN is collected in Express onboarding;
      // this endpoint only refreshes w9Submitted from Stripe requirements.
      void data;
      const status = await this.getStripeAccountStatus(userId);
      if (!status.hasAccount) {
        throw new BadRequestException(
          'Complete Stripe Connect onboarding before tax status can be synced.',
        );
      }
      if (!status.w9Submitted) {
        throw new BadRequestException(
          'Tax information is collected in Stripe Connect embedded onboarding. Finish bank and tax details there, then refresh status.',
        );
      }
      return { success: true, usesStripeConnect: true };
    }

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
        'Complete payment setup (ACH or check) before submitting W-9',
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
    return { success: true, usesStripeConnect: false };
  }

  /**
   * Sync account status from Stripe or Bill.com
   */
  async syncAccountStatus(userId: string) {
    this.logger.log(`Syncing account status for user: ${userId}`);

    if (this.useStripe()) {
      const status = await this.getStripeAccountStatus(userId);
      return {
        userId,
        stripeAccountId: status.accountId,
        accountStatus: status.accountStatus,
        paymentEnabled: status.paymentEnabled,
        w9Submitted: status.w9Submitted,
        payoutsEnabled: status.payoutsEnabled,
      };
    }

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
      this.logger.error(`Sync failed: ${(error as Error).message}`);
      throw new BadRequestException(
        `Sync failed: ${(error as Error).message}`,
      );
    }
  }
}
