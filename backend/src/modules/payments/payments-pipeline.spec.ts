import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import {
  PIPELINE_EXCEPTION_ACTIONS,
  PIPELINE_STATUSES,
  providerReleasedCents,
} from './dto/payment-pipeline.contract';

const NOW = new Date('2026-10-27T12:00:00.000Z');

function registration(overrides: Record<string, unknown> = {}) {
  const userId = (overrides.userId as string | undefined) ?? 'user-1';
  const base = {
    userId,
    programId: 'prog-1',
    status: 'APPROVED',
    postEventAttendanceStatus: 'VERIFIED',
    postEventSurveyAcknowledgedAt: new Date('2026-10-01T12:00:00.000Z'),
    postEventAttendanceReviewedAt: new Date('2026-09-30T12:00:00.000Z'),
    honorariumRequestedAt: new Date('2026-10-02T12:00:00.000Z'),
    user: {
      id: userId,
      email: `${userId}@example.com`,
      firstName: userId,
      lastName: 'User',
      w9Submitted: true,
      stripePayoutsEnabled: true,
    },
    program: {
      id: 'prog-1',
      title: 'Cardiology webinar',
      honorariumAmount: 50_000,
    },
  };
  const merged = { ...base, ...overrides };
  if (overrides.user) {
    merged.user = { ...base.user, ...(overrides.user as object), id: userId };
  }
  if (overrides.program) {
    merged.program = { ...base.program, ...(overrides.program as object) };
  }
  merged.userId = userId;
  return merged;
}

describe('PaymentsService.listPipeline', () => {
  const prisma = {
    programRegistration: { findMany: jest.fn() },
    payment: { findMany: jest.fn() },
    surveyResponse: { findMany: jest.fn() },
  };
  const stripeService = { isConfigured: jest.fn() };
  const configService = { get: jest.fn() };
  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.surveyResponse.findMany.mockResolvedValue([]);
    service = new PaymentsService(
      prisma as never,
      stripeService as never,
      configService as never,
    );
  });

  it('asks only for non-rejected honorarium registrations and honorarium payments', async () => {
    prisma.programRegistration.findMany.mockResolvedValue([]);
    await service.listPipeline({}, NOW);
    expect(prisma.programRegistration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { not: 'REJECTED' },
          program: { honorariumAmount: { gt: 0 } },
        },
      }),
    );
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it('uses the default window when a program window is invalid', async () => {
    prisma.programRegistration.findMany.mockResolvedValue([
      registration({
        program: { honorariumWindowDays: 0, honorariumAtRiskDays: 99 },
      }),
    ]);
    const result = await service.listPipeline({}, NOW);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.aging).toEqual({
      daysSinceSurvey: 26,
      atRisk: true,
      overdue: false,
    });
  });

  it('skips an unmatched survey that has no program', async () => {
    prisma.programRegistration.findMany.mockResolvedValue([]);
    prisma.surveyResponse.findMany.mockResolvedValue([
      {
        id: 'sr-1',
        userId: null,
        isDraft: false,
        submittedAt: new Date('2026-10-01T00:00:00.000Z'),
        publicRegistration: null,
        survey: { program: null },
      },
    ]);
    const result = await service.listPipeline({}, NOW);
    expect(result.rows).toEqual([]);
    expect(result.exceptions).toEqual([]);
  });

  it('derives each primary status from registration and honorarium payments', async () => {
    const rows = [
      registration({
        userId: 'reg',
        user: { w9Submitted: false, stripePayoutsEnabled: false },
        status: 'PENDING',
        postEventAttendanceStatus: 'NOT_REQUIRED',
        postEventSurveyAcknowledgedAt: null,
        honorariumRequestedAt: null,
      }),
      registration({
        userId: 'appr',
        user: { w9Submitted: false, stripePayoutsEnabled: false },
        postEventAttendanceStatus: 'PENDING_VERIFICATION',
        postEventSurveyAcknowledgedAt: null,
        honorariumRequestedAt: null,
      }),
      registration({
        userId: 'att',
        user: { w9Submitted: false, stripePayoutsEnabled: false },
        postEventSurveyAcknowledgedAt: null,
        honorariumRequestedAt: null,
      }),
      registration({
        userId: 'surv',
        user: { w9Submitted: false, stripePayoutsEnabled: false },
        honorariumRequestedAt: null,
      }),
      registration({
        userId: 'info',
        honorariumRequestedAt: null,
      }),
      registration({ userId: 'elig' }),
      registration({ userId: 'pend' }),
      registration({ userId: 'paid' }),
      registration({ userId: 'fail' }),
    ];
    prisma.programRegistration.findMany.mockResolvedValue(rows);
    prisma.payment.findMany.mockResolvedValue([
      { userId: 'pend', programId: 'prog-1', status: 'PENDING', amount: 50_000, stripeTransferId: null, stripePayoutId: null, paidAt: null },
      { userId: 'paid', programId: 'prog-1', status: 'PAID', amount: 40_000, stripeTransferId: 'tr_paid', stripePayoutId: 'po_paid', paidAt: new Date('2026-10-20T00:00:00.000Z') },
      { userId: 'fail', programId: 'prog-1', status: 'FAILED', amount: 50_000, stripeTransferId: null, stripePayoutId: null, paidAt: null },
      { userId: 'elig', programId: 'prog-1', status: 'CANCELLED', amount: 1, stripeTransferId: null, stripePayoutId: null, paidAt: null },
    ]);

    const result = await service.listPipeline({}, NOW);
    const byUser = Object.fromEntries(result.rows.map((row) => [row.userId, row.status]));
    expect(byUser).toEqual({
      reg: 'registered',
      appr: 'approved',
      att: 'attended',
      surv: 'survey_completed',
      info: 'payment_info_on_file',
      elig: 'payment_eligible',
      pend: 'release_pending',
      paid: 'paid',
      fail: 'failed',
    });
    expect(result.counts.map((c) => c.status)).toEqual([...PIPELINE_STATUSES]);
    expect(result.counts.find((c) => c.status === 'on_hold')?.count).toBe(0);
    const paid = result.rows.find((row) => row.userId === 'paid');
    expect(paid?.amountCents).toBe(40_000);
    expect(paid?.stripeTransferId).toBe('tr_paid');
    expect(paid?.releaseAt).toBe('2026-10-20T00:00:00.000Z');
    expect(paid?.attendanceRecordedAt).toBe('2026-09-30T12:00:00.000Z');
    expect(paid?.surveyCompletedAt).toBe('2026-10-01T12:00:00.000Z');
    expect(paid?.paymentDetailsConfirmedAt).toBe('2026-10-02T12:00:00.000Z');
    expect(paid?.stripePayoutId).toBe('po_paid');
    expect(paid?.payoutDetailsOrigin).toBeNull();
    expect(paid?.totals).toEqual({
      committedCents: 40_000,
      releasedCents: 40_000,
      outstandingCents: 0,
    });
    expect(result.rows.find((row) => row.userId === 'surv')?.exceptions).toEqual([
      'missing_payment_details',
    ]);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'HONORARIUM' }),
      }),
    );
  });

  it('keeps status counts and honorarium totals when the status filter narrows rows', async () => {
    prisma.programRegistration.findMany.mockResolvedValue([
      registration({ userId: 'elig', honorariumRequestedAt: new Date('2026-10-02T00:00:00.000Z') }),
      registration({
        userId: 'paid',
        user: {
          id: 'paid',
          email: 'paid@example.com',
          firstName: 'Paid',
          lastName: 'User',
          w9Submitted: true,
          stripePayoutsEnabled: true,
        },
      }),
    ]);
    prisma.payment.findMany.mockResolvedValue([
      {
        userId: 'paid',
        programId: 'prog-1',
        status: 'PAID',
        amount: 40_000,
        stripeTransferId: 'tr_paid',
        stripePayoutId: null,
        paidAt: NOW,
      },
    ]);

    const result = await service.listPipeline({ status: 'paid' }, NOW);
    expect(result.rows.map((row) => row.userId)).toEqual(['paid']);
    expect(result.counts.find((c) => c.status === 'payment_eligible')?.count).toBe(1);
    expect(result.counts.find((c) => c.status === 'paid')?.count).toBe(1);
    expect(result.totals).toEqual({
      committedCents: 90_000,
      releasedCents: 40_000,
      outstandingCents: 50_000,
    });
    expect(result.programs).toEqual([
      {
        programId: 'prog-1',
        programTitle: 'Cardiology webinar',
        totals: result.totals,
      },
    ]);
  });

  it('filters by program, name or email, and survey date', async () => {
    prisma.programRegistration.findMany.mockResolvedValue([
      registration(),
      registration({
        userId: 'other',
        programId: 'prog-2',
        user: {
          id: 'other',
          email: 'other@example.com',
          firstName: 'Other',
          lastName: 'Person',
          w9Submitted: true,
          stripePayoutsEnabled: true,
        },
        program: { id: 'prog-2', title: 'Other webinar', honorariumAmount: 10_000 },
        postEventSurveyAcknowledgedAt: new Date('2026-08-01T00:00:00.000Z'),
      }),
    ]);
    prisma.payment.findMany.mockResolvedValue([]);

    const byProgram = await service.listPipeline({ programId: 'prog-1' }, NOW);
    expect(prisma.programRegistration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ programId: 'prog-1' }),
      }),
    );
    expect(byProgram.rows.every((row) => row.programId === 'prog-1')).toBe(true);

    prisma.programRegistration.findMany.mockResolvedValue([
      registration({ user: { firstName: 'Ada', lastName: 'Lovelace' } }),
      registration({
        userId: 'other',
        user: { firstName: 'Other', lastName: 'Person' },
        postEventSurveyAcknowledgedAt: new Date('2026-08-01T00:00:00.000Z'),
      }),
    ]);
    const byName = await service.listPipeline({ q: 'LOVE' }, NOW);
    expect(byName.rows.map((row) => row.userId)).toEqual(['user-1']);

    const byDate = await service.listPipeline(
      { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T00:00:00.000Z' },
      NOW,
    );
    expect(byDate.rows.map((row) => row.userId)).toEqual(['user-1']);
  });

  it('drops rows with no survey date when a date bound is set', async () => {
    prisma.programRegistration.findMany.mockResolvedValue([
      registration({ postEventSurveyAcknowledgedAt: null, honorariumRequestedAt: null, postEventAttendanceStatus: 'VERIFIED' }),
    ]);
    const result = await service.listPipeline({ from: '2026-10-01T00:00:00.000Z' }, NOW);
    expect(result.rows).toEqual([]);
    expect(result.counts.every((c) => c.count === 0)).toBe(true);
  });

  it('marks a pending payout with heldAt as on_hold', async () => {
    prisma.programRegistration.findMany.mockResolvedValue([
      registration({ userId: 'held' }),
    ]);
    prisma.payment.findMany.mockResolvedValue([
      {
        userId: 'held',
        programId: 'prog-1',
        status: 'PENDING',
        amount: 50_000,
        stripeTransferId: null,
        stripePayoutId: null,
        paidAt: null,
        heldAt: new Date('2026-10-10T00:00:00.000Z'),
        holdReason: 'finance review',
      },
    ]);
    const result = await service.listPipeline({}, NOW);
    expect(result.rows[0]?.status).toBe('on_hold');
    expect(result.rows[0]?.holdReason).toBe('finance review');
    expect(result.counts.find((c) => c.status === 'on_hold')?.count).toBe(1);
  });

  it('uses the program window for at-risk, overdue, and the unpaid queue', async () => {
    const day = 86_400_000;
    prisma.programRegistration.findMany.mockResolvedValue([
      registration({
        userId: 'risk',
        postEventSurveyAcknowledgedAt: new Date(NOW.getTime() - 22 * day),
        program: { honorariumWindowDays: 30, honorariumAtRiskDays: 21 },
      }),
      registration({
        userId: 'late',
        postEventSurveyAcknowledgedAt: new Date(NOW.getTime() - 31 * day),
        program: { honorariumWindowDays: 30, honorariumAtRiskDays: 21 },
        user: { email: 'late@example.com' },
      }),
      registration({
        userId: 'short',
        postEventSurveyAcknowledgedAt: new Date(NOW.getTime() - 11 * day),
        program: { honorariumWindowDays: 10, honorariumAtRiskDays: 8, title: 'Short window' },
        user: { email: 'short@example.com' },
      }),
      registration({
        userId: 'settled',
        postEventSurveyAcknowledgedAt: new Date(NOW.getTime() - 40 * day),
        program: { honorariumWindowDays: 30, honorariumAtRiskDays: 21 },
        user: { email: 'settled@example.com' },
      }),
    ]);
    prisma.payment.findMany.mockResolvedValue([
      {
        userId: 'late',
        programId: 'prog-1',
        status: 'FAILED',
        amount: 50_000,
        stripeTransferId: null,
        stripePayoutId: null,
        paidAt: null,
        heldAt: null,
        holdReason: null,
      },
      {
        userId: 'settled',
        programId: 'prog-1',
        status: 'PAID',
        amount: 50_000,
        stripeTransferId: 'tr_settled',
        stripePayoutId: null,
        paidAt: NOW,
        heldAt: null,
        holdReason: null,
      },
    ]);

    const result = await service.listPipeline({ status: 'payment_eligible' }, NOW);
    const risk = result.rows.find((row) => row.userId === 'risk');
    expect(risk?.aging).toEqual({ daysSinceSurvey: 22, atRisk: true, overdue: false });
    expect(result.rows.map((row) => row.userId)).toEqual(['risk', 'short']);
    expect(result.overdueRows.map((row) => row.userId)).toEqual(['late', 'short']);
    expect(result.overdueRows.find((row) => row.userId === 'late')?.aging).toEqual({
      daysSinceSurvey: 31,
      atRisk: false,
      overdue: true,
    });
    expect(result.overdueRows.find((row) => row.userId === 'short')?.aging).toEqual({
      daysSinceSurvey: 11,
      atRisk: false,
      overdue: true,
    });
    expect(result.rows.find((row) => row.userId === 'settled')).toBeUndefined();
    expect(result.overdueRows.find((row) => row.userId === 'settled')).toBeUndefined();
  });

  it('returns new, reused, and unrecorded payout origins', async () => {
    prisma.programRegistration.findMany.mockResolvedValue([
      registration({ userId: 'first', payoutDetailsOrigin: 'NEW' }),
      registration({
        userId: 'again',
        payoutDetailsOrigin: 'REUSED',
        user: { email: 'again@example.com' },
      }),
      registration({
        userId: 'old',
        payoutDetailsOrigin: null,
        user: { email: 'old@example.com' },
      }),
    ]);
    const result = await service.listPipeline({}, NOW);
    const origin = Object.fromEntries(
      result.rows.map((row) => [row.userId, row.payoutDetailsOrigin]),
    );
    expect(origin).toEqual({ first: 'new', again: 'reused', old: null });
  });

  it('queues every exception type with its next action', async () => {
    prisma.programRegistration.findMany.mockResolvedValue([
      registration({
        userId: 'details',
        honorariumRequestedAt: null,
        user: { w9Submitted: false, stripePayoutsEnabled: false, email: 'details@example.com' },
      }),
      registration({
        userId: 'broken',
        user: { email: 'broken@example.com' },
      }),
      registration({
        userId: 'twice',
        user: { email: 'twice@example.com' },
      }),
    ]);
    prisma.payment.findMany.mockResolvedValue([
      {
        userId: 'broken',
        programId: 'prog-1',
        status: 'FAILED',
        amount: 50_000,
        stripeTransferId: null,
        stripePayoutId: null,
        paidAt: null,
        heldAt: null,
        holdReason: null,
        failureReason: 'bank account closed',
      },
      {
        userId: 'twice',
        programId: 'prog-1',
        status: 'PAID',
        amount: 40_000,
        stripeTransferId: 'tr_twice',
        stripePayoutId: null,
        paidAt: NOW,
        heldAt: null,
        holdReason: null,
        failureReason: null,
      },
      {
        userId: 'twice',
        programId: 'prog-1',
        status: 'FAILED',
        amount: 40_000,
        stripeTransferId: null,
        stripePayoutId: null,
        paidAt: null,
        heldAt: null,
        holdReason: null,
        failureReason: 'should not surface after a later paid row',
      },
    ]);
    prisma.surveyResponse.findMany.mockResolvedValue([
      {
        id: 'sr-1',
        userId: null,
        isDraft: false,
        submittedAt: new Date('2026-10-03T00:00:00.000Z'),
        publicRegistration: { firstName: 'Public', lastName: 'Guest', email: 'guest@example.com' },
        survey: { program: { id: 'prog-1', title: 'Cardiology webinar' } },
      },
      {
        id: 'sr-draft',
        userId: null,
        isDraft: true,
        submittedAt: new Date('2026-10-03T00:00:00.000Z'),
        publicRegistration: null,
        survey: { program: { id: 'prog-1', title: 'Cardiology webinar' } },
      },
      {
        id: 'sr-other',
        userId: null,
        isDraft: false,
        submittedAt: new Date('2026-10-03T00:00:00.000Z'),
        publicRegistration: null,
        survey: { program: { id: 'prog-2', title: 'Other webinar' } },
      },
    ]);

    const result = await service.listPipeline({ programId: 'prog-1', status: 'paid' }, NOW);
    expect(result.rows.map((row) => row.userId)).toEqual(['twice']);
    expect(result.exceptions.map((item) => item.code)).toEqual([
      'missing_payment_details',
      'provider_error',
      'survey_unmatched',
      'duplicate_payouts',
    ]);
    expect(result.exceptions.map((item) => item.action)).toEqual([
      PIPELINE_EXCEPTION_ACTIONS.missing_payment_details,
      PIPELINE_EXCEPTION_ACTIONS.provider_error,
      PIPELINE_EXCEPTION_ACTIONS.survey_unmatched,
      PIPELINE_EXCEPTION_ACTIONS.duplicate_payouts,
    ]);
    expect(result.exceptions.find((item) => item.code === 'provider_error')?.failureReason).toBe(
      'bank account closed',
    );
    expect(result.exceptions.find((item) => item.code === 'duplicate_payouts')?.failureReason).toBeNull();
    expect(result.exceptions.find((item) => item.code === 'survey_unmatched')).toMatchObject({
      surveyResponseId: 'sr-1',
      userId: null,
      userEmail: 'guest@example.com',
      programId: 'prog-1',
    });
  });

  it('matches released cents to paid rows with a Stripe transfer in the survey period', async () => {
    prisma.programRegistration.findMany.mockResolvedValue([
      registration({
        userId: 'paid-a',
        postEventSurveyAcknowledgedAt: new Date('2026-10-05T12:00:00.000Z'),
        user: { email: 'a@example.com' },
      }),
      registration({
        userId: 'manual',
        postEventSurveyAcknowledgedAt: new Date('2026-10-06T12:00:00.000Z'),
        user: { email: 'manual@example.com' },
      }),
      registration({
        userId: 'elig',
        postEventSurveyAcknowledgedAt: new Date('2026-10-07T12:00:00.000Z'),
        user: { email: 'elig@example.com' },
      }),
      registration({
        userId: 'paid-b',
        programId: 'prog-2',
        postEventSurveyAcknowledgedAt: new Date('2026-10-08T12:00:00.000Z'),
        program: { id: 'prog-2', title: 'Endocrine webinar', honorariumAmount: 20_000 },
        user: { email: 'b@example.com' },
      }),
      registration({
        userId: 'old',
        programId: 'prog-2',
        postEventSurveyAcknowledgedAt: new Date('2026-09-01T12:00:00.000Z'),
        program: { id: 'prog-2', title: 'Endocrine webinar', honorariumAmount: 99_000 },
        user: { email: 'old@example.com' },
      }),
    ]);
    prisma.payment.findMany.mockResolvedValue([
      {
        userId: 'paid-a',
        programId: 'prog-1',
        status: 'PAID',
        amount: 40_000,
        stripeTransferId: 'tr_a',
        stripePayoutId: 'po_a',
        paidAt: NOW,
        heldAt: null,
        holdReason: null,
        failureReason: null,
      },
      {
        userId: 'manual',
        programId: 'prog-1',
        status: 'PAID',
        amount: 15_000,
        stripeTransferId: null,
        stripePayoutId: null,
        paidAt: NOW,
        heldAt: null,
        holdReason: null,
        failureReason: null,
      },
      {
        userId: 'paid-b',
        programId: 'prog-2',
        status: 'PAID',
        amount: 20_000,
        stripeTransferId: 'tr_b',
        stripePayoutId: null,
        paidAt: NOW,
        heldAt: null,
        holdReason: null,
        failureReason: null,
      },
      {
        userId: 'old',
        programId: 'prog-2',
        status: 'PAID',
        amount: 99_000,
        stripeTransferId: 'tr_old',
        stripePayoutId: null,
        paidAt: NOW,
        heldAt: null,
        holdReason: null,
        failureReason: null,
      },
    ]);

    const query = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.999Z' };
    const result = await service.listPipeline(query, NOW);
    expect(result.rows.map((row) => row.userId).sort()).toEqual([
      'elig',
      'manual',
      'paid-a',
      'paid-b',
    ]);
    expect(result.totals).toEqual({
      committedCents: 125_000,
      releasedCents: 60_000,
      outstandingCents: 65_000,
    });
    expect(providerReleasedCents(result.rows)).toBe(result.totals.releasedCents);
    expect(result.programs).toEqual([
      {
        programId: 'prog-1',
        programTitle: 'Cardiology webinar',
        totals: { committedCents: 105_000, releasedCents: 40_000, outstandingCents: 65_000 },
      },
      {
        programId: 'prog-2',
        programTitle: 'Endocrine webinar',
        totals: { committedCents: 20_000, releasedCents: 20_000, outstandingCents: 0 },
      },
    ]);

    const narrowed = await service.listPipeline({ ...query, status: 'failed' }, NOW);
    expect(narrowed.rows).toEqual([]);
    expect(narrowed.totals).toEqual(result.totals);
    expect(narrowed.programs).toEqual(result.programs);
  });

  it('exports only the filtered pipeline rows with amounts and provider refs', async () => {
    prisma.programRegistration.findMany.mockResolvedValue([
      registration({
        userId: 'paid',
        user: { email: 'paid@example.com', firstName: 'Paid', lastName: 'User' },
      }),
      registration({
        userId: 'elig',
        user: { email: 'elig@example.com', firstName: 'Eligible', lastName: 'User' },
      }),
      registration({
        userId: 'other',
        programId: 'prog-2',
        program: { id: 'prog-2', title: 'Other webinar' },
        user: { email: 'other@example.com', firstName: 'Other', lastName: 'User' },
      }),
    ]);
    prisma.payment.findMany.mockResolvedValue([
      {
        userId: 'paid',
        programId: 'prog-1',
        status: 'PAID',
        amount: 40_000,
        stripeTransferId: 'tr_paid',
        stripePayoutId: 'po_paid',
        paidAt: NOW,
        heldAt: null,
        holdReason: null,
        failureReason: null,
      },
      {
        userId: 'other',
        programId: 'prog-2',
        status: 'PAID',
        amount: 10_000,
        stripeTransferId: 'tr_other',
        stripePayoutId: null,
        paidAt: NOW,
        heldAt: null,
        holdReason: null,
        failureReason: null,
      },
    ]);

    const csv = await service.exportPipelineCsv({
      programId: 'prog-1',
      status: 'paid',
    });
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('stripeTransferId');
    expect(lines[0]).toContain('amountCents');
    expect(lines[0]).not.toContain('accountNumber');
    expect(lines[0]).not.toContain('routingNumber');
    expect(lines[0]).not.toContain('taxId');
    expect(lines[1]).toContain('paid@example.com');
    expect(lines[1]).toContain('tr_paid');
    expect(lines[1]).toContain('po_paid');
    expect(lines[1]).toContain('40000');
    expect(lines[1]).toContain('400.00');
    expect(csv).not.toContain('elig@example.com');
    expect(csv).not.toContain('other@example.com');
    expect(csv).not.toContain('tr_other');
  });

  it('rejects an unknown status and an inverted date range', async () => {
    await expect(service.listPipeline({ status: 'PENDING' }, NOW)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.listPipeline(
        { from: '2026-10-20T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' },
        NOW,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.programRegistration.findMany).not.toHaveBeenCalled();
    await expect(service.listPipeline({ from: 'not-a-date' }, NOW)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
