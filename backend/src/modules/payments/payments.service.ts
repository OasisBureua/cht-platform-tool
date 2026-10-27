import { randomUUID } from 'crypto';
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import {
  Prisma,
  PostEventAttendanceStatus,
  ProgramZoomSessionType,
  type Payment,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { AuthUser } from '../../auth/auth.service';
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
import {
  PAYMENT_AUDIT_ACTIONS,
  PIPELINE_STATUSES,
  agingFromSurvey,
  countPipelineStatuses,
  deriveExceptionCodes,
  derivePipelineStatus,
  matchesPersonQuery,
  normalizePayoutDetailsOrigin,
  overdueUnpaidRows,
  pipelineAmountCents,
  pipelineCsv,
  pipelineExceptionItems,
  pipelineFailureReason,
  pipelineHoldReason,
  pipelineProviderRefs,
  pipelineRowTotals,
  sortPipelineExceptions,
  sumPipelineTotals,
  surveyDateInRange,
  unmatchedSurveyExceptionItem,
  type PipelineDerivationInput,
  type PipelinePaymentRef,
  type PipelineStatus,
} from './dto/payment-pipeline.contract';
import {
  PipelineProgramTotalsDto,
  PipelineResponseDto,
  PipelineRowDto,
} from './dto/payment-pipeline.dto';
import { validateTaxId, sanitizeCompanyName } from './w9-validation';
import { assertProfileCompleteForPayments } from '../../common/profile-payment-eligibility';
import { programHasPostEventSurvey } from '../../utils/program-survey-config';

function bulkActionError(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: string | string[] }).message;
      if (Array.isArray(message)) return message.join(', ');
      if (typeof message === 'string' && message.trim()) return message;
    }
  }
  return 'Payment action failed';
}

/** Use the program window only when both days are stored. Otherwise the contract defaults apply. */
function programHonorariumWindow(program: {
  honorariumWindowDays?: number | null;
  honorariumAtRiskDays?: number | null;
}): { windowDays?: number; atRiskDays?: number } {
  const windowDays = program.honorariumWindowDays;
  const atRiskDays = program.honorariumAtRiskDays;
  if (typeof windowDays !== 'number' || typeof atRiskDays !== 'number') return {};
  return { windowDays, atRiskDays };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
    private configService: ConfigService,
    private audit: AuditService,
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
  async deletePaymentById(
    paymentId: string,
    actor?: AuthUser,
  ): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, status: true, userId: true, programId: true },
    });
    if (!existing) {
      throw new NotFoundException('Payment not found');
    }
    await this.prisma.payment.delete({ where: { id: paymentId } });
    this.recordPaymentAudit(actor, 'payment.delete', paymentId, {
      status: existing.status,
      userId: existing.userId,
      programId: existing.programId,
    });
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
  async createManualPendingPayment(dto: CreateManualPaymentDto, actor?: AuthUser) {
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

    const created = await this.prisma.payment.create({
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
    this.recordPaymentAudit(actor, 'payment.manual_create', created.id, {
      userId: created.userId,
      programId: created.programId,
      amountCents: created.amount,
      type: created.type,
    });
    return created;
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
   * SCRUM-292: honorarium pipeline for admin. Does not change program-summary
   * or the pending / paid / failed lists.
   *
   * Counts, headline totals, and per-program totals ignore the status filter.
   * Rows follow it. Released counts paid honoraria that have a Stripe transfer.
   * `payoutDetailsOrigin` is the snapshot stored at honorarium request.
   * Rows requested before that column existed stay null.
   * A PENDING row with heldAt set is on_hold.
   */
  async listPipeline(
    query: {
      programId?: string;
      status?: string;
      from?: string;
      to?: string;
      q?: string;
    },
    now: Date = new Date(),
  ): Promise<PipelineResponseDto> {
    const statusFilter = this.parsePipelineStatus(query.status);
    const from = this.parsePipelineInstant(query.from, 'from');
    const to = this.parsePipelineInstant(query.to, 'to');
    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException('from must be before or equal to to');
    }

    const registrations = await this.prisma.programRegistration.findMany({
      where: {
        status: { not: 'REJECTED' },
        program: { honorariumAmount: { gt: 0 } },
        ...(query.programId?.trim()
          ? { programId: query.programId.trim() }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            w9Submitted: true,
            stripePayoutsEnabled: true,
          },
        },
        program: {
          select: {
            id: true,
            title: true,
            honorariumAmount: true,
            honorariumWindowDays: true,
            honorariumAtRiskDays: true,
          },
        },
      },
    });

    const programIds = [...new Set(registrations.map((r) => r.programId))];
    const userIds = [...new Set(registrations.map((r) => r.userId))];
    const paymentRows =
      programIds.length === 0
        ? []
        : await this.prisma.payment.findMany({
            where: {
              type: 'HONORARIUM',
              programId: { in: programIds },
              userId: { in: userIds },
            },
            select: {
              userId: true,
              programId: true,
              status: true,
              amount: true,
              stripeTransferId: true,
              stripePayoutId: true,
              paidAt: true,
              heldAt: true,
              holdReason: true,
              failureReason: true,
            },
          });

    const paymentsByPair = new Map<string, PipelinePaymentRef[]>();
    const paidAtByPair = new Map<string, Date | null>();
    const failureReasonByPair = new Map<string, string | null>();
    for (const payment of paymentRows) {
      if (!payment.programId) continue;
      const key = `${payment.userId}:${payment.programId}`;
      const ref: PipelinePaymentRef = {
        status: payment.status,
        amountCents: payment.amount,
        held: payment.heldAt != null,
        holdReason: payment.holdReason,
        stripeTransferId: payment.stripeTransferId,
        stripePayoutId: payment.stripePayoutId,
        failureReason: payment.failureReason,
      };
      const list = paymentsByPair.get(key) ?? [];
      list.push(ref);
      paymentsByPair.set(key, list);
      if (payment.status === 'PAID' && payment.paidAt) {
        paidAtByPair.set(key, payment.paidAt);
      }
      failureReasonByPair.set(key, pipelineFailureReason(paymentsByPair.get(key) ?? []));
    }

    const matched: PipelineRowDto[] = [];
    const programFilter = query.programId?.trim() || null;
    for (const reg of registrations) {
      if (programFilter && reg.programId !== programFilter) continue;
      const userName = `${reg.user.firstName ?? ''} ${reg.user.lastName ?? ''}`.trim();
      if (!matchesPersonQuery(userName, reg.user.email ?? '', query.q ?? '')) {
        continue;
      }
      const surveyAt = reg.postEventSurveyAcknowledgedAt;
      if (!surveyDateInRange(surveyAt, from, to)) continue;

      const key = `${reg.userId}:${reg.programId}`;
      const payments = paymentsByPair.get(key) ?? [];
      const derived: PipelineDerivationInput = {
        registrationStatus: reg.status,
        attendanceStatus: reg.postEventAttendanceStatus,
        surveyCompletedAt: surveyAt,
        payoutProfileComplete:
          reg.user.w9Submitted === true && reg.user.stripePayoutsEnabled === true,
        honorariumRequestedAt: reg.honorariumRequestedAt,
        honorariumAmountCents: reg.program.honorariumAmount ?? 0,
        payments,
      };
      const status = derivePipelineStatus(derived);
      if (!status) continue;

      const amountCents = pipelineAmountCents(derived);
      const refs = pipelineProviderRefs(payments);
      let aging;
      try {
        aging = agingFromSurvey({
          surveyCompletedAt: surveyAt,
          asOf: now,
          ...programHonorariumWindow(reg.program),
        });
      } catch {
        this.logger.warn(
          `Ignoring invalid honorarium window on program ${reg.programId}`,
        );
        aging = agingFromSurvey({
          surveyCompletedAt: surveyAt,
          asOf: now,
        });
      }
      matched.push({
        status,
        programId: reg.programId,
        programTitle: reg.program.title?.trim() || 'Untitled program',
        userId: reg.userId,
        userName,
        userEmail: reg.user.email ?? '',
        amountCents,
        surveyCompletedAt: surveyAt ? surveyAt.toISOString() : null,
        aging,
        payoutDetailsOrigin: normalizePayoutDetailsOrigin(reg.payoutDetailsOrigin),
        paymentDetailsConfirmedAt: reg.honorariumRequestedAt
          ? reg.honorariumRequestedAt.toISOString()
          : null,
        attendanceRecordedAt: reg.postEventAttendanceReviewedAt
          ? reg.postEventAttendanceReviewedAt.toISOString()
          : null,
        releaseAt: paidAtByPair.get(key)?.toISOString() ?? null,
        stripeTransferId: refs.stripeTransferId,
        stripePayoutId: refs.stripePayoutId,
        holdReason: pipelineHoldReason(payments),
        exceptions: deriveExceptionCodes(derived, status),
        totals: pipelineRowTotals(status, amountCents, Boolean(refs.stripeTransferId?.trim())),
      });
    }

    matched.sort((a, b) => {
      const byProgram = a.programTitle.localeCompare(b.programTitle);
      if (byProgram !== 0) return byProgram;
      return a.userEmail.localeCompare(b.userEmail);
    });

    const rows = statusFilter
      ? matched.filter((row) => row.status === statusFilter)
      : matched;
    const programs = this.pipelineProgramTotals(matched);
    const unmatched = await this.listUnmatchedSurveyExceptions({
      programId: programFilter,
      from,
      to,
      q: query.q ?? '',
    });

    return {
      counts: countPipelineStatuses(matched.map((row) => row.status)),
      totals: sumPipelineTotals(matched.map((row) => row.totals)),
      programs,
      overdueRows: overdueUnpaidRows(matched),
      rows,
      exceptions: sortPipelineExceptions([
        ...pipelineExceptionItems(
          matched.map((row) => ({
            ...row,
            failureReason:
              failureReasonByPair.get(`${row.userId}:${row.programId}`) ?? null,
          })),
        ),
        ...unmatched,
      ]),
    };
  }

  /**
   * Post-event feedback with no user account. Drafts are ignored.
   * A response is unmatched to a person; the survey's program is still shown.
   */
  private async listUnmatchedSurveyExceptions(opts: {
    programId: string | null;
    from: Date | null;
    to: Date | null;
    q: string;
  }) {
    const responses = await this.prisma.surveyResponse.findMany({
      where: {
        isDraft: false,
        userId: null,
        survey: {
          type: 'FEEDBACK',
          program: {
            honorariumAmount: { gt: 0 },
            ...(opts.programId ? { id: opts.programId } : {}),
          },
        },
      },
      select: {
        id: true,
        userId: true,
        isDraft: true,
        submittedAt: true,
        publicRegistration: {
          select: { firstName: true, lastName: true, email: true },
        },
        survey: {
          select: {
            program: { select: { id: true, title: true } },
          },
        },
      },
    });

    const items: ReturnType<typeof unmatchedSurveyExceptionItem>[] = [];
    for (const response of responses) {
      if (response.isDraft || response.userId) continue;
      const program = response.survey?.program;
      if (!program?.id) continue;
      const programId = program.id;
      if (opts.programId && programId !== opts.programId) continue;
      if (!surveyDateInRange(response.submittedAt, opts.from, opts.to)) continue;
      const userName =
        `${response.publicRegistration?.firstName ?? ''} ${response.publicRegistration?.lastName ?? ''}`.trim();
      const userEmail = response.publicRegistration?.email ?? '';
      if (!matchesPersonQuery(userName, userEmail, opts.q)) continue;
      items.push(
        unmatchedSurveyExceptionItem({
          surveyResponseId: response.id,
          programId,
          programTitle: program.title?.trim() || 'Untitled program',
          userName: userName || null,
          userEmail: userEmail || null,
        }),
      );
    }
    return items;
  }

  private pipelineProgramTotals(rows: PipelineRowDto[]): PipelineProgramTotalsDto[] {
    const byProgram = new Map<string, PipelineRowDto[]>();
    for (const row of rows) {
      const list = byProgram.get(row.programId) ?? [];
      list.push(row);
      byProgram.set(row.programId, list);
    }
    return [...byProgram.entries()]
      .map(([programId, programRows]) => ({
        programId,
        programTitle: programRows[0]?.programTitle ?? 'Untitled program',
        totals: sumPipelineTotals(programRows.map((row) => row.totals)),
      }))
      .sort((a, b) => a.programTitle.localeCompare(b.programTitle));
  }

  private parsePipelineStatus(status: string | undefined): PipelineStatus | null {
    const raw = status?.trim();
    if (!raw) return null;
    if ((PIPELINE_STATUSES as readonly string[]).includes(raw)) {
      return raw as PipelineStatus;
    }
    throw new BadRequestException(
      `status must be one of: ${PIPELINE_STATUSES.join(', ')}`,
    );
  }

  private parsePipelineInstant(
    value: string | undefined,
    name: 'from' | 'to',
  ): Date | null {
    const raw = value?.trim();
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${name} must be an ISO date`);
    }
    return date;
  }

  /**
   * Honorarium pipeline CSV for the current filters. Rows follow the status
   * filter. Columns are the frozen pipeline set: amounts and provider refs,
   * no account or tax id.
   */
  async exportPipelineCsv(query: {
    programId?: string;
    status?: string;
    from?: string;
    to?: string;
    q?: string;
  }): Promise<string> {
    const pipeline = await this.listPipeline(query);
    return pipelineCsv(pipeline.rows);
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
  /**
   * Release (pay now) or hold each id on its own. One failure does not stop the rest.
   * Hold requires a reason before any id is touched. Each success writes its own audit row.
   */
  async bulkPayments(
    input: { action: 'release' | 'hold'; paymentIds: string[]; reason?: string },
    actor?: AuthUser,
  ): Promise<{
    results: Array<{ paymentId: string; ok: boolean; error?: string }>;
  }> {
    const ids = [...new Set(input.paymentIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) {
      throw new BadRequestException('Select at least one payment');
    }
    if (ids.length > 100) {
      throw new BadRequestException('Select at most 100 payments');
    }
    if (input.action === 'hold' && !input.reason?.trim()) {
      throw new BadRequestException('A hold reason is required');
    }
    if (input.action !== 'release' && input.action !== 'hold') {
      throw new BadRequestException('action must be release or hold');
    }

    const results: Array<{ paymentId: string; ok: boolean; error?: string }> = [];
    for (const paymentId of ids) {
      try {
        if (input.action === 'hold') {
          await this.holdPayment(paymentId, input.reason ?? '', actor);
        } else {
          await this.payNow(paymentId, actor);
        }
        results.push({ paymentId, ok: true });
      } catch (err) {
        results.push({ paymentId, ok: false, error: bulkActionError(err) });
      }
    }
    return { results };
  }

  async holdPayment(paymentId: string, reason: string, actor?: AuthUser) {
    const trimmed = reason?.trim() ?? '';
    if (!trimmed) {
      throw new BadRequestException('A hold reason is required');
    }
    if (trimmed.length > 500) {
      throw new BadRequestException('Hold reason must be 500 characters or fewer');
    }
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.heldAt) {
      throw new BadRequestException('Payment is already on hold');
    }
    if (payment.status !== 'PENDING') {
      throw new BadRequestException(
        `Only a pending payment can be held (status: ${payment.status})`,
      );
    }
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        heldAt: new Date(),
        heldByUserId: actor?.userId ?? null,
        holdReason: trimmed,
      },
    });
    this.recordPaymentAudit(actor, 'payment.hold', paymentId, { reason: trimmed });
    return updated;
  }

  async releaseHold(paymentId: string, actor?: AuthUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (!payment.heldAt) {
      throw new BadRequestException('Payment is not on hold');
    }
    if (payment.status !== 'PENDING') {
      throw new BadRequestException(
        `Only a pending payment can be released from hold (status: ${payment.status})`,
      );
    }
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { heldAt: null, heldByUserId: null, holdReason: null },
    });
    this.recordPaymentAudit(actor, 'payment.release_hold', paymentId, {
      previousReason: payment.holdReason,
    });
    return updated;
  }

  async retryPayment(paymentId: string, actor?: AuthUser): Promise<PayoutResponseDto> {
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

    this.recordPaymentAudit(actor, 'payment.retry', paymentId);
    this.logger.log(`Retrying failed payment: ${paymentId}`);
    return this.payNow(paymentId, actor);
  }

  /**
   * Pay a specific PENDING payment via Stripe Connect (admin only). "Pay now" button flow.
   */
  async payNow(paymentId: string, actor?: AuthUser): Promise<PayoutResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.heldAt) {
      throw new BadRequestException(
        'Payment is on hold. Release the hold before paying.',
      );
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

    this.assertStripeConfigured();

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

    return this.payNowWithStripe(paymentId, payment, user, actor);
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
    actor?: AuthUser,
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
      where: { id: paymentId, status: 'PENDING', heldAt: null },
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
      this.recordPaymentAudit(actor, 'payment.release', paymentId, {
        transferId: transfer.id,
        amountCents: payment.amount,
      });
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

  private recordPaymentAudit(
    actor: AuthUser | undefined,
    action: (typeof PAYMENT_AUDIT_ACTIONS)[number],
    paymentId: string,
    metadata?: Prisma.InputJsonObject,
  ): void {
    if (!actor?.userId) return;
    this.audit.record({
      actorId: actor.userId,
      actorEmail: actor.email ?? null,
      actorRole: actor.role ?? null,
      action,
      resource: 'payment',
      resourceId: paymentId,
      metadata,
    });
  }
}
