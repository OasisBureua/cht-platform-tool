/**
 * SCRUM-292 API contract (Chunk 0) — freeze before route wiring.
 *
 * One pipeline row is one program registration on the honorarium path.
 * Webinar and program are the same id (`programId`). REJECTED registrations
 * are omitted. Unmatched surveys are not a status; they are the
 * `survey_unmatched` exception (Chunk 6).
 *
 * Primary status is mutually exclusive. Payment state wins over the
 * registration waterfall:
 *   any PAID → paid
 *   else any held payment → on_hold
 *   else any PENDING or PROCESSING → release_pending
 *   else any FAILED → failed
 *   else waterfall below
 * CANCELLED payments are ignored. A held+PAID row stays `paid`.
 *
 * Waterfall (first incomplete gate):
 *   not APPROVED → registered (SURVEY_SUBMITTED, PENDING, WAITLISTED)
 *   attendance not passed → approved
 *   no survey ack → attended
 *   payout profile incomplete → survey_completed
 *   honorarium > 0 and honorarium requested → payment_eligible
 *   else → payment_info_on_file
 *
 * Attendance gate passed: VERIFIED or NOT_REQUIRED.
 * DENIED and PENDING_VERIFICATION stay `approved`.
 *
 * Payout profile complete: W-9 on file and Stripe payouts enabled.
 * Full account numbers are never part of this contract.
 *
 * Totals (cents), per row, then summed. Headline and per-program totals
 * follow program, survey date, and name/email. The status query does not
 * change them.
 *   committed = amount when status is payment_eligible, release_pending,
 *               on_hold, failed, or paid
 *   released = amount when paid and stripeTransferId is set, else 0
 *   outstanding = committed − released
 * Amount is the active payment's cents when one exists, otherwise the
 * program honorarium. A paid row with no Stripe transfer stays outstanding.
 *
 * Aging is days from survey ack to `asOf` (floor, UTC ms / 86400000).
 * Window is 1–30 days (default 30). At-risk threshold is 1–window
 * (default 21). At-risk means days >= threshold and days <= window.
 * Overdue means days > window (not also at-risk).
 *
 * Date filter `from`/`to` (Chunk 1) is inclusive on surveyCompletedAt.
 * A row with no survey date is excluded when either bound is set.
 *
 * SCRUM-275 program-summary (PENDING / PAID / FAILED) is unchanged.
 */

export const PIPELINE_STATUSES = [
  'registered',
  'approved',
  'attended',
  'survey_completed',
  'payment_info_on_file',
  'payment_eligible',
  'release_pending',
  'paid',
  'failed',
  'on_hold',
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

/** Statuses that count toward "committed" honorarium. */
export const COMMITTED_PIPELINE_STATUSES = [
  'payment_eligible',
  'release_pending',
  'on_hold',
  'failed',
  'paid',
] as const satisfies readonly PipelineStatus[];

export const DEFAULT_HONORARIUM_WINDOW_DAYS = 30;
export const DEFAULT_HONORARIUM_AT_RISK_DAYS = 21;
export const HONORARIUM_WINDOW_MIN_DAYS = 1;
export const HONORARIUM_WINDOW_MAX_DAYS = 30;

export const PAYMENT_AUDIT_ACTIONS = [
  'payment.release',
  'payment.retry',
  'payment.delete',
  'payment.manual_create',
  'payment.edit',
  'payment.hold',
  'payment.release_hold',
] as const;

export type PaymentAuditAction = (typeof PAYMENT_AUDIT_ACTIONS)[number];

/** Filtered-view CSV. No account, routing, or tax-id columns. */
export const PIPELINE_CSV_COLUMNS = [
  'pipelineStatus',
  'amountCents',
  'amountDollars',
  'programId',
  'programTitle',
  'userName',
  'userEmail',
  'surveyCompletedAt',
  'daysSinceSurvey',
  'atRisk',
  'overdue',
  'stripeTransferId',
  'stripePayoutId',
  'holdReason',
] as const;

export const PIPELINE_CSV_FORBIDDEN_COLUMNS = [
  'accountNumber',
  'bankAccountNumber',
  'routingNumber',
  'ssn',
  'taxId',
] as const;

export const PIPELINE_EXCEPTION_CODES = [
  'missing_payment_details',
  'provider_error',
  'survey_unmatched',
  'duplicate_payouts',
] as const;

export type PipelineExceptionCode = (typeof PIPELINE_EXCEPTION_CODES)[number];

export const PIPELINE_EXCEPTION_ACTIONS: Record<PipelineExceptionCode, string> =
  {
    missing_payment_details:
      'Ask the HCP to finish W-9 and payout profile',
    provider_error: 'Retry the payout or fix the Stripe account',
    survey_unmatched: 'Match the survey response to a user and webinar',
    duplicate_payouts: 'Review duplicate payouts before releasing again',
  };

/** Query names for GET /payments/pipeline (Chunk 1). */
export const PIPELINE_QUERY = {
  programId: 'programId',
  status: 'status',
  from: 'from',
  to: 'to',
  q: 'q',
} as const;

const MS_PER_DAY = 86_400_000;

export type RegistrationPipelineStatus =
  | 'SURVEY_SUBMITTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'WAITLISTED';

export type AttendancePipelineStatus =
  | 'NOT_REQUIRED'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'DENIED';

export type PaymentRowStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED';

export interface PipelinePaymentRef {
  status: PaymentRowStatus;
  amountCents: number;
  held?: boolean;
  holdReason?: string | null;
  stripeTransferId?: string | null;
  stripePayoutId?: string | null;
  failureReason?: string | null;
}

export interface PipelineDerivationInput {
  registrationStatus: RegistrationPipelineStatus | null;
  attendanceStatus: AttendancePipelineStatus | null;
  surveyCompletedAt: Date | null;
  /** W-9 on file and Stripe payouts enabled. */
  payoutProfileComplete: boolean;
  honorariumRequestedAt: Date | null;
  honorariumAmountCents: number;
  payments: PipelinePaymentRef[];
}

export function attendanceGatePassed(
  status: AttendancePipelineStatus | null,
): boolean {
  return status === 'VERIFIED' || status === 'NOT_REQUIRED';
}

export function activePayments(
  payments: PipelinePaymentRef[],
): PipelinePaymentRef[] {
  return payments.filter((p) => p.status !== 'CANCELLED');
}

/**
 * Mutually exclusive primary status, or null when the registration is
 * missing or REJECTED (not an honorarium pipeline row).
 */
export function derivePipelineStatus(
  input: PipelineDerivationInput,
): PipelineStatus | null {
  if (
    input.registrationStatus == null ||
    input.registrationStatus === 'REJECTED'
  ) {
    return null;
  }

  const active = activePayments(input.payments);
  if (active.some((p) => p.status === 'PAID')) return 'paid';
  if (active.some((p) => p.held)) return 'on_hold';
  if (
    active.some((p) => p.status === 'PENDING' || p.status === 'PROCESSING')
  ) {
    return 'release_pending';
  }
  if (active.some((p) => p.status === 'FAILED')) return 'failed';

  if (input.registrationStatus !== 'APPROVED') return 'registered';
  if (!attendanceGatePassed(input.attendanceStatus)) return 'approved';
  if (!input.surveyCompletedAt) return 'attended';
  if (!input.payoutProfileComplete) return 'survey_completed';
  if (input.honorariumAmountCents > 0 && input.honorariumRequestedAt) {
    return 'payment_eligible';
  }
  return 'payment_info_on_file';
}

export function isCommittedStatus(status: PipelineStatus): boolean {
  return (COMMITTED_PIPELINE_STATUSES as readonly string[]).includes(status);
}

/** Payment cents when an active row exists; otherwise the program honorarium. */
export function pipelineAmountCents(input: PipelineDerivationInput): number {
  const active = activePayments(input.payments);
  const paid = active.find((p) => p.status === 'PAID');
  if (paid) return paid.amountCents;
  const held = active.find((p) => p.held);
  if (held) return held.amountCents;
  const open = active.find(
    (p) => p.status === 'PENDING' || p.status === 'PROCESSING',
  );
  if (open) return open.amountCents;
  const failed = active.find((p) => p.status === 'FAILED');
  if (failed) return failed.amountCents;
  return input.honorariumAmountCents;
}

export interface PipelineRowTotals {
  committedCents: number;
  releasedCents: number;
  outstandingCents: number;
}

export function pipelineRowTotals(
  status: PipelineStatus | null,
  amountCents: number,
  hasProviderTransfer = false,
): PipelineRowTotals {
  if (!status || !isCommittedStatus(status)) {
    return { committedCents: 0, releasedCents: 0, outstandingCents: 0 };
  }
  const releasedCents = status === 'paid' && hasProviderTransfer ? amountCents : 0;
  return {
    committedCents: amountCents,
    releasedCents,
    outstandingCents: amountCents - releasedCents,
  };
}

/** Paid cents that have a Stripe transfer. This is the released total. */
export function providerReleasedCents(
  rows: Array<{
    status: PipelineStatus;
    amountCents: number;
    stripeTransferId: string | null;
  }>,
): number {
  return rows.reduce((sum, row) => {
    if (row.status !== 'paid' || !row.stripeTransferId?.trim()) return sum;
    return sum + row.amountCents;
  }, 0);
}

export function sumPipelineTotals(
  rows: PipelineRowTotals[],
): PipelineRowTotals {
  return rows.reduce(
    (acc, row) => ({
      committedCents: acc.committedCents + row.committedCents,
      releasedCents: acc.releasedCents + row.releasedCents,
      outstandingCents: acc.outstandingCents + row.outstandingCents,
    }),
    { committedCents: 0, releasedCents: 0, outstandingCents: 0 },
  );
}

export interface HonorariumAging {
  daysSinceSurvey: number | null;
  atRisk: boolean;
  overdue: boolean;
}

export function assertHonorariumWindow(
  windowDays: number,
  atRiskDays: number,
): void {
  if (
    !Number.isInteger(windowDays) ||
    windowDays < HONORARIUM_WINDOW_MIN_DAYS ||
    windowDays > HONORARIUM_WINDOW_MAX_DAYS
  ) {
    throw new Error(
      `honorarium window must be an integer from ${HONORARIUM_WINDOW_MIN_DAYS} to ${HONORARIUM_WINDOW_MAX_DAYS}`,
    );
  }
  if (
    !Number.isInteger(atRiskDays) ||
    atRiskDays < HONORARIUM_WINDOW_MIN_DAYS ||
    atRiskDays > windowDays
  ) {
    throw new Error(
      'at-risk threshold must be an integer from 1 through the honorarium window',
    );
  }
}

export function agingFromSurvey(opts: {
  surveyCompletedAt: Date | null;
  asOf: Date;
  windowDays?: number;
  atRiskDays?: number;
}): HonorariumAging {
  const windowDays = opts.windowDays ?? DEFAULT_HONORARIUM_WINDOW_DAYS;
  const atRiskDays = opts.atRiskDays ?? DEFAULT_HONORARIUM_AT_RISK_DAYS;
  assertHonorariumWindow(windowDays, atRiskDays);
  if (!opts.surveyCompletedAt) {
    return { daysSinceSurvey: null, atRisk: false, overdue: false };
  }
  const days = Math.floor(
    (opts.asOf.getTime() - opts.surveyCompletedAt.getTime()) / MS_PER_DAY,
  );
  const daysSinceSurvey = Math.max(0, days);
  const overdue = daysSinceSurvey > windowDays;
  const atRisk = !overdue && daysSinceSurvey >= atRiskDays;
  return { daysSinceSurvey, atRisk, overdue };
}

/** Statuses that still owe the honorarium. Paid is released, so it is not unpaid. */
const UNPAID_HONORARIUM_STATUSES = [
  'payment_eligible',
  'release_pending',
  'on_hold',
  'failed',
] as const satisfies readonly PipelineStatus[];

export function isUnpaidHonorariumStatus(status: PipelineStatus): boolean {
  return (UNPAID_HONORARIUM_STATUSES as readonly PipelineStatus[]).includes(status);
}

/**
 * Overdue queue: survey is past the program window and the honorarium is not paid.
 * Includes people still missing payment details. A paid row can be past the window;
 * it is not listed here. The status filter does not apply. Longest wait first.
 */
export function overdueUnpaidRows<
  T extends { status: PipelineStatus; aging: HonorariumAging },
>(rows: T[]): T[] {
  return rows
    .filter((row) => row.aging.overdue && row.status !== 'paid')
    .sort(
      (a, b) => (b.aging.daysSinceSurvey ?? 0) - (a.aging.daysSinceSurvey ?? 0),
    );
}

/**
 * True when a survey timestamp falls in the inclusive from/to range.
 * Missing survey date fails when either bound is set.
 */
export function surveyDateInRange(
  surveyCompletedAt: Date | null,
  from: Date | null,
  to: Date | null,
): boolean {
  if (!from && !to) return true;
  if (!surveyCompletedAt) return false;
  if (from && surveyCompletedAt.getTime() < from.getTime()) return false;
  if (to && surveyCompletedAt.getTime() > to.getTime()) return false;
  return true;
}

export function deriveExceptionCodes(
  input: PipelineDerivationInput,
  status: PipelineStatus | null,
): PipelineExceptionCode[] {
  const codes: PipelineExceptionCode[] = [];
  if (status === 'survey_completed') codes.push('missing_payment_details');
  // Only while the primary status is failed. A later PAID row is not a retry.
  if (status === 'failed') codes.push('provider_error');
  if (activePayments(input.payments).length > 1) codes.push('duplicate_payouts');
  return codes;
}

/** Case-insensitive name or email contains. Blank query matches everyone. */
export function matchesPersonQuery(
  name: string,
  email: string,
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return `${name} ${email}`.toLowerCase().includes(needle);
}

/** Exception for a survey response that is not tied to a user and program. */
export function unmatchedSurveyException(): PipelineExceptionCode[] {
  return ['survey_unmatched'];
}

export interface PipelineExceptionItem {
  code: PipelineExceptionCode;
  action: string;
  programId: string | null;
  programTitle: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  surveyResponseId: string | null;
  failureReason: string | null;
}

/** Failure text from a FAILED honorarium payment. Blank text becomes null. */
export function pipelineFailureReason(
  payments: PipelinePaymentRef[],
): string | null {
  for (const payment of activePayments(payments)) {
    if (payment.status !== 'FAILED') continue;
    const reason = payment.failureReason?.trim();
    if (reason) return reason;
  }
  return null;
}

/**
 * One queue item per exception code on a pipeline row.
 * `failureReason` is included only for `provider_error`.
 * Suggested action text comes from {@link PIPELINE_EXCEPTION_ACTIONS}.
 */
export function pipelineExceptionItems(
  rows: Array<{
    programId: string;
    programTitle: string;
    userId: string;
    userName: string;
    userEmail: string;
    exceptions: PipelineExceptionCode[];
    failureReason?: string | null;
  }>,
): PipelineExceptionItem[] {
  const items: PipelineExceptionItem[] = [];
  for (const row of rows) {
    for (const code of row.exceptions) {
      const reason = row.failureReason?.trim();
      items.push({
        code,
        action: PIPELINE_EXCEPTION_ACTIONS[code],
        programId: row.programId,
        programTitle: row.programTitle,
        userId: row.userId,
        userName: row.userName,
        userEmail: row.userEmail,
        surveyResponseId: null,
        failureReason: code === 'provider_error' && reason ? reason : null,
      });
    }
  }
  return items;
}

/** Submitted feedback with no user account. The program is shown when the survey has one. */
export function unmatchedSurveyExceptionItem(input: {
  surveyResponseId: string;
  programId: string | null;
  programTitle: string | null;
  userName: string | null;
  userEmail: string | null;
}): PipelineExceptionItem {
  return {
    code: 'survey_unmatched',
    action: PIPELINE_EXCEPTION_ACTIONS.survey_unmatched,
    programId: input.programId,
    programTitle: input.programTitle,
    userId: null,
    userName: input.userName,
    userEmail: input.userEmail,
    surveyResponseId: input.surveyResponseId,
    failureReason: null,
  };
}

/** Stable queue order: exception code, then email. */
export function sortPipelineExceptions(
  items: PipelineExceptionItem[],
): PipelineExceptionItem[] {
  const order = new Map(
    PIPELINE_EXCEPTION_CODES.map((code, index) => [code, index]),
  );
  return [...items].sort((a, b) => {
    const byCode = (order.get(a.code) ?? 0) - (order.get(b.code) ?? 0);
    if (byCode !== 0) return byCode;
    return (a.userEmail ?? '').localeCompare(b.userEmail ?? '');
  });
}

export function pipelineCsvHeader(): string {
  return PIPELINE_CSV_COLUMNS.join(',');
}

function pipelineCsvCell(value: string | number | boolean | null | undefined): string {
  let text = value == null ? '' : String(value);
  // Finance opens this file in a spreadsheet. A leading = + - or @ would run as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** One CSV line per pipeline row, in {@link PIPELINE_CSV_COLUMNS} order. */
export function pipelineCsv(
  rows: Array<{
    status: PipelineStatus;
    amountCents: number;
    programId: string;
    programTitle: string;
    userName: string;
    userEmail: string;
    surveyCompletedAt: string | null;
    aging: { daysSinceSurvey: number | null; atRisk: boolean; overdue: boolean };
    stripeTransferId: string | null;
    stripePayoutId: string | null;
    holdReason: string | null;
  }>,
): string {
  const lines = rows.map((row) =>
    [
      row.status,
      row.amountCents,
      (row.amountCents / 100).toFixed(2),
      row.programId,
      row.programTitle,
      row.userName,
      row.userEmail,
      row.surveyCompletedAt ?? '',
      row.aging.daysSinceSurvey ?? '',
      row.aging.atRisk,
      row.aging.overdue,
      row.stripeTransferId ?? '',
      row.stripePayoutId ?? '',
      row.holdReason ?? '',
    ]
      .map(pipelineCsvCell)
      .join(','),
  );
  return [pipelineCsvHeader(), ...lines].join('\n');
}

export type PayoutDetailsOrigin = 'new' | 'reused';

/**
 * Snapshotted when the learner requests an honorarium.
 * `reused` when this user already has another honorarium request or a
 * non-cancelled honorarium payment (the Stripe account is already in use).
 * `new` on the first confirmation.
 * Rows requested before the column existed stay null. Do not backfill them.
 */
export function payoutDetailsOriginForRequest(
  priorHonorariumUses: number,
): PayoutDetailsOrigin {
  return priorHonorariumUses > 0 ? 'reused' : 'new';
}

/** Accepts the stored enum (NEW / REUSED) or the API value. Anything else is null. */
export function normalizePayoutDetailsOrigin(
  value: string | null | undefined,
): PayoutDetailsOrigin | null {
  const raw = value?.trim().toLowerCase();
  if (raw === 'new' || raw === 'reused') return raw;
  return null;
}

/** Counts for every status, including zeros, in pipeline order. Nulls are skipped. */
export function countPipelineStatuses(
  statuses: Array<PipelineStatus | null>,
): { status: PipelineStatus; count: number }[] {
  const counts = Object.fromEntries(
    PIPELINE_STATUSES.map((status) => [status, 0]),
  ) as Record<PipelineStatus, number>;
  for (const status of statuses) {
    if (status) counts[status] += 1;
  }
  return PIPELINE_STATUSES.map((status) => ({ status, count: counts[status] }));
}

/** Hold reason from the held payment that produced `on_hold`, if any. */
export function pipelineHoldReason(
  payments: PipelinePaymentRef[],
): string | null {
  const held = activePayments(payments).find((p) => p.held);
  const reason = held?.holdReason?.trim();
  return reason ? reason : null;
}

/**
 * Provider reference from the payment that owns the primary status:
 * PAID, else held, else open, else failed.
 */
export function pipelineProviderRefs(payments: PipelinePaymentRef[]): {
  stripeTransferId: string | null;
  stripePayoutId: string | null;
} {
  const active = activePayments(payments);
  const source =
    active.find((p) => p.status === 'PAID') ??
    active.find((p) => p.held) ??
    active.find((p) => p.status === 'PENDING' || p.status === 'PROCESSING') ??
    active.find((p) => p.status === 'FAILED') ??
    null;
  return {
    stripeTransferId: source?.stripeTransferId ?? null,
    stripePayoutId: source?.stripePayoutId ?? null,
  };
}
