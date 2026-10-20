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
  type Payment,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';
import {
  CreateConnectAccountResponseDto,
  AccountLinkResponseDto,
} from './dto/create-connect-account.dto';
import { CreatePayoutDto, PayoutResponseDto } from './dto/create-payout.dto';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';
import { AccountStatusDto } from './dto/account-status.dto';
import {
  PROGRAM_PAYMENT_SCOPE_NONE,
  ProgramPaymentSummaryItemDto,
  ProgramPaymentSummaryResponseDto,
  ProgramPaymentStatusTotalsDto,
} from './dto/program-payment-summary.dto';
import { validateTaxId, sanitizeCompanyName } from './w9-validation';
import { assertProfileCompleteForPayments } from '../../common/profile-payment-eligibility';
import { programHasPostEventSurvey } from '../../utils/program-survey-config';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>('frontendUrl') || 'http://localhost:3000';
  }

  private assertStripeConfigured(): void {
    if (!this.stripeService.isConfigured()) {
      throw new BadRequestException(
        'Stripe Connect is not configured in this environment.',
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
    hasHonorarium: boolean;
    payeeDisplayName: string;
    maskedBankLast4: string | null;
    addressSummary: string | null;
    hasPayoutAccount: boolean;
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
          stripeAccountId: true,
          stripePayoutsEnabled: true,
          bankAccountLast4: true,
          w9Submitted: true,
          specialty: true,
          npiNumber: true,
          phoneNumber: true,
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

    const maskedBankLast4: string | null = user.bankAccountLast4 ?? null;
    const hasPayoutAccount = !!user.stripeAccountId;

    return {
      programTitle: program.title,
      hasHonorarium: true,
      payeeDisplayName,
      maskedBankLast4,
      addressSummary,
      hasPayoutAccount,
      w9Submitted: user.w9Submitted,
    };
  }

  /**
   * Ensure a Stripe Connect recipient account exists; does not create Account Links.
   */
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

  /**
   * Create / retrieve Stripe Connect Express account and return hosted Account Link URL.
   */
  async createConnectAccount(
    userId: string,
  ): Promise<CreateConnectAccountResponseDto> {
    this.assertStripeConfigured();
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
    this.assertStripeConfigured();
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

  /**
   * Stripe Account Link (Express onboarding URL).
   */
  async createAccountLink(userId: string): Promise<AccountLinkResponseDto> {
    this.assertStripeConfigured();
    const created = await this.createConnectAccount(userId);
    return {
      url: created.onboardingUrl,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  /**
   * Get user's Stripe Connect payment account status.
   */
  async getAccountStatus(userId: string): Promise<AccountStatusDto> {
    this.assertStripeConfigured();
    return this.getStripeAccountStatus(userId);
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
   * Delete payments by userId and optional programId (admin/dev only).
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
   * Optional list scope for admin payment lists.
   * - omitted / empty → no program filter
   * - `none` → programId IS NULL
   * - otherwise → that program id
   */
  private parseProgramIdScope(
    programId?: string,
  ): { programId: string | null } | undefined {
    if (programId == null) return undefined;
    const trimmed = programId.trim();
    if (!trimmed) return undefined;
    if (trimmed === PROGRAM_PAYMENT_SCOPE_NONE) {
      return { programId: null };
    }
    return { programId: trimmed };
  }

  private adminPaymentListInclude() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          stripeAccountId: true,
          stripePayoutsEnabled: true,
          w9Submitted: true,
          preferredPaymentMethod: true,
          bankAccountLast4: true,
        },
      },
      program: {
        select: {
          id: true,
          title: true,
          chmProgramId: true,
          sponsorName: true,
        },
      },
    } as const;
  }

  /**
   * List pending payments (admin only). Optional `programId` / `none` scope.
   */
  async getPendingPayments(programId?: string) {
    const scope = this.parseProgramIdScope(programId);
    return this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        ...(scope ? { programId: scope.programId } : {}),
      },
      include: this.adminPaymentListInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Preview Pay-now eligibility for an admin manual honorarium tied to a program.
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
      warnings.push(
        'No registration found for this user on the selected program.',
      );
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

    const hasPayoutAccount =
      !!user.stripeAccountId && !!user.stripePayoutsEnabled;
    const w9Submitted = !!user.w9Submitted;
    if (!hasPayoutAccount) {
      warnings.push('HCP has not completed Stripe Connect ACH onboarding yet.');
    }
    if (!w9Submitted) {
      warnings.push(
        'Tax details are not complete on the Stripe Connect account yet.',
      );
    }

    const programEligibilityOk =
      !!reg &&
      attendanceOk &&
      (!surveyRequired || surveyAcknowledged) &&
      reg.postEventAttendanceStatus !== PostEventAttendanceStatus.DENIED;

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
      hasPayoutAccount,
      w9Submitted,
      programEligibilityOk,
      payNowReady,
      warnings,
    };
  }

  /**
   * Create a PENDING payment for admin review (no immediate Stripe payout).
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
            w9Submitted: true,
          },
        },
        program: {
          select: {
            id: true,
            title: true,
            chmProgramId: true,
            sponsorName: true,
          },
        },
      },
    });
  }

  /**
   * List failed payments (admin). Optional `programId` / `none` scope.
   */
  async getFailedPayments(programId?: string) {
    const scope = this.parseProgramIdScope(programId);
    return this.prisma.payment.findMany({
      where: {
        status: 'FAILED',
        ...(scope ? { programId: scope.programId } : {}),
      },
      include: this.adminPaymentListInclude(),
      orderBy: { failedAt: 'desc' },
    });
  }

  /**
   * Successful payouts (admin payments page). Newest first.
   */
  async getPaidPaymentsForAdmin(limit?: number, programId?: string) {
    const scope = this.parseProgramIdScope(programId);
    const scoped = scope !== undefined;
    const defaultTake = scoped ? 1000 : 200;
    const maxTake = scoped ? 2000 : 500;
    const raw =
      limit != null && Number.isFinite(limit) ? Number(limit) : defaultTake;
    const take = Math.min(Math.max(raw, 1), maxTake);
    return this.prisma.payment.findMany({
      where: {
        status: 'PAID',
        ...(scope ? { programId: scope.programId } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            w9Submitted: true,
            preferredPaymentMethod: true,
            bankAccountLast4: true,
          },
        },
        program: {
          select: {
            id: true,
            title: true,
            chmProgramId: true,
            sponsorName: true,
          },
        },
      },
      orderBy: [{ paidAt: 'desc' }, { updatedAt: 'desc' }],
      take,
    });
  }

  /**
   * All-time PENDING / PAID / FAILED totals per program (admin).
   */
  async getProgramPaymentSummary(): Promise<ProgramPaymentSummaryResponseDto> {
    const emptyTotals = (): ProgramPaymentStatusTotalsDto => ({
      count: 0,
      totalCents: 0,
    });

    const grouped = await this.prisma.payment.groupBy({
      by: ['programId', 'status'],
      where: {
        status: { in: ['PENDING', 'PAID', 'FAILED'] },
      },
      _count: { _all: true },
      _sum: { amount: true },
    });

    type Bucket = {
      programId: string | null;
      pending: ProgramPaymentStatusTotalsDto;
      paid: ProgramPaymentStatusTotalsDto;
      failed: ProgramPaymentStatusTotalsDto;
    };

    const byProgram = new Map<string, Bucket>();
    const mapKey = (programId: string | null) => programId ?? '__none__';

    for (const row of grouped) {
      const key = mapKey(row.programId);
      let bucket = byProgram.get(key);
      if (!bucket) {
        bucket = {
          programId: row.programId,
          pending: emptyTotals(),
          paid: emptyTotals(),
          failed: emptyTotals(),
        };
        byProgram.set(key, bucket);
      }

      const totals: ProgramPaymentStatusTotalsDto = {
        count: row._count._all,
        totalCents: row._sum.amount ?? 0,
      };
      if (row.status === 'PENDING') bucket.pending = totals;
      else if (row.status === 'PAID') bucket.paid = totals;
      else if (row.status === 'FAILED') bucket.failed = totals;
    }

    const programIds = [...byProgram.values()]
      .map((b) => b.programId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const programsMeta =
      programIds.length === 0
        ? []
        : await this.prisma.program.findMany({
            where: { id: { in: programIds } },
            select: {
              id: true,
              title: true,
              chmProgramId: true,
              sponsorName: true,
            },
          });
    const metaById = new Map(programsMeta.map((p) => [p.id, p]));

    const programs: ProgramPaymentSummaryItemDto[] = [...byProgram.values()].map(
      (bucket) => {
        if (bucket.programId === null) {
          return {
            programId: null,
            title: 'No program',
            chmProgramId: null,
            sponsorName: null,
            pending: bucket.pending,
            paid: bucket.paid,
            failed: bucket.failed,
          };
        }
        const meta = metaById.get(bucket.programId);
        return {
          programId: bucket.programId,
          title: meta?.title?.trim() || 'Untitled program',
          chmProgramId: meta?.chmProgramId ?? null,
          sponsorName: meta?.sponsorName ?? null,
          pending: bucket.pending,
          paid: bucket.paid,
          failed: bucket.failed,
        };
      },
    );

    programs.sort((a, b) => {
      if (a.programId === null) return 1;
      if (b.programId === null) return -1;
      return a.title.localeCompare(b.title);
    });

    return { programs };
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
        ...(createdAt && Object.keys(createdAt).length ? { createdAt } : {}),
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
        program: {
          select: {
            id: true,
            title: true,
            chmProgramId: true,
            sponsorName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const escape = (value: string | number | null | undefined) => {
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
      'chmProgramId',
      'campaignLabel',
      'createdAt',
      'paidAt',
      'failedAt',
      'stripeTransferId',
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
        p.program?.chmProgramId ?? '',
        p.program?.sponsorName ?? '',
        p.createdAt?.toISOString?.() ?? '',
        p.paidAt?.toISOString?.() ?? '',
        p.failedAt?.toISOString?.() ?? '',
        p.stripeTransferId ?? '',
      ]
        .map(escape)
        .join(','),
    );

    return [header, ...lines].join('\n');
  }

  /**
   * Reset a FAILED payment back to PENDING and immediately attempt payment via Stripe Connect (admin only).
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
   * Pay a specific PENDING payment via Stripe Connect (admin only). "Pay now" button flow.
   */
  async payNow(paymentId: string): Promise<PayoutResponseDto> {
    this.assertStripeConfigured();

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

    // For honorarium payments tied to a program, enforce the eligibility contract.
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
          payment.programId,
          reg.program.jotformSurveyUrl,
        )) &&
        !reg.postEventSurveyAcknowledgedAt
      ) {
        throw new ForbiddenException(
          `Cannot pay: post-event survey has not been acknowledged for ${user.id} on program ${payment.programId}.`,
        );
      }
    }

    return this.payNowWithStripe(paymentId, payment, user);
  }

  private async payNowWithStripe(
    paymentId: string,
    payment: {
      id: string;
      userId: string;
      programId: string | null;
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

    const program = payment.programId
      ? await this.prisma.program.findUnique({
          where: { id: payment.programId },
          select: { chmProgramId: true, sponsorName: true, title: true },
        })
      : null;

    try {
      const transfer = await this.stripeService.createTransfer({
        amountCents: payment.amount,
        destinationAccountId: user.stripeAccountId,
        paymentId: payment.id,
        userId: payment.userId,
        description: payment.description || `${payment.type} payment`,
        programId: payment.programId,
        chmProgramId: program?.chmProgramId,
        campaignLabel: program?.sponsorName || program?.title,
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
   * Create payout to user via Stripe Connect (admin only).
   * Pass `idempotencyKey` (or reuse the same key on retry) for safe deduplication.
   */
  async createPayout(dto: CreatePayoutDto): Promise<PayoutResponseDto> {
    this.assertStripeConfigured();
    this.logger.log(
      `Creating payout for user ${dto.userId}: $${dto.amount / 100}`,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.stripeAccountId || !user.stripePayoutsEnabled) {
      throw new BadRequestException(
        'User does not have an active Stripe Connect account ready for payouts.',
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
      if (existingByKey.status === 'PAID' && existingByKey.stripeTransferId) {
        this.logger.log(
          `createPayout idempotent replay key=${idempotencyKey} payment=${existingByKey.id}`,
        );
        return {
          paymentId: existingByKey.id,
          amount: existingByKey.amount,
          status: 'PAID',
          transferId: existingByKey.stripeTransferId,
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

    let payment: Payment;
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
        if (lostRace?.status === 'PAID' && lostRace.stripeTransferId) {
          return {
            paymentId: lostRace.id,
            amount: lostRace.amount,
            status: 'PAID',
            transferId: lostRace.stripeTransferId,
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
      const program = dto.programId
        ? await this.prisma.program.findUnique({
            where: { id: dto.programId },
            select: { chmProgramId: true, sponsorName: true, title: true },
          })
        : null;
      const transfer = await this.stripeService.createTransfer({
        amountCents: dto.amount,
        destinationAccountId: user.stripeAccountId!,
        paymentId: payment.id,
        userId: dto.userId,
        description: dto.description || 'Honorarium payment',
        programId: dto.programId,
        chmProgramId: program?.chmProgramId,
        campaignLabel: program?.sponsorName || program?.title,
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

  /**
   * Get payment summary for user (available balance, pending, lifetime earnings).
   */
  async getSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
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
      stripeConnected: !!user.stripeAccountId,
      stripeAccountId: user.stripeAccountId,
    };
  }

  /**
   * Get payment history for user.
   */
  async getHistory(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      include: { program: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return payments.map((p) => ({
      id: p.id,
      date: (p.paidAt || p.createdAt).toISOString(),
      title: p.description || p.program?.title || p.type.replace(/_/g, ' '),
      programId: p.programId ?? p.program?.id ?? null,
      programTitle: p.program?.title ?? null,
      amount: p.amount / 100,
      status: p.status,
      method:
        p.deliveryMethod === 'CHECK'
          ? 'Check'
          : p.deliveryMethod === 'ACH'
            ? 'ACH'
            : p.stripeTransferId
              ? 'Stripe'
              : 'ACH',
      deliveryMethod: p.deliveryMethod ?? null,
      checkStatus: p.checkStatus ?? null,
      checkMailedAt: p.checkMailedAt?.toISOString() ?? null,
      checkDeliveredAt: p.checkDeliveredAt?.toISOString() ?? null,
      checkTrackingInfo: p.checkTrackingInfo ?? null,
    }));
  }

  /**
   * Stripe Connect: sync w9Submitted from Connect requirements.
   * TIN is collected in Express onboarding; this endpoint refreshes the cached status.
   */
  async submitW9(
    userId: string,
    data: { taxId: string; taxIdType: 'SSN' | 'EIN'; companyName?: string },
  ): Promise<{ success: boolean; usesStripeConnect?: boolean }> {
    this.assertStripeConfigured();
    // TIN is collected in Stripe Connect embedded onboarding; validate format then
    // confirm status is reflected from the account requirements.
    const taxId = data.taxId.replace(/\D/g, '');
    const validation = validateTaxId(taxId, data.taxIdType);
    if (!validation.valid) {
      throw new BadRequestException(
        validation.error || 'Invalid tax ID format',
      );
    }
    // sanitizeCompanyName is kept so callers can still pass companyName without error.
    void sanitizeCompanyName(data.companyName);

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

  /**
   * Sync Stripe Connect account status.
   */
  async syncAccountStatus(userId: string) {
    this.assertStripeConfigured();
    this.logger.log(`Syncing account status for user: ${userId}`);
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
}
