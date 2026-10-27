import {
  COMMITTED_PIPELINE_STATUSES,
  DEFAULT_HONORARIUM_AT_RISK_DAYS,
  DEFAULT_HONORARIUM_WINDOW_DAYS,
  PAYMENT_AUDIT_ACTIONS,
  PIPELINE_CSV_COLUMNS,
  PIPELINE_CSV_FORBIDDEN_COLUMNS,
  PIPELINE_EXCEPTION_ACTIONS,
  PIPELINE_EXCEPTION_CODES,
  PIPELINE_QUERY,
  PIPELINE_STATUSES,
  agingFromSurvey,
  assertHonorariumWindow,
  countPipelineStatuses,
  deriveExceptionCodes,
  derivePipelineStatus,
  isUnpaidHonorariumStatus,
  overdueUnpaidRows,
  matchesPersonQuery,
  pipelineAmountCents,
  pipelineCsv,
  pipelineCsvHeader,
  normalizePayoutDetailsOrigin,
  payoutDetailsOriginForRequest,
  pipelineExceptionItems,
  pipelineFailureReason,
  pipelineHoldReason,
  pipelineProviderRefs,
  unmatchedSurveyExceptionItem,
  pipelineRowTotals,
  providerReleasedCents,
  sumPipelineTotals,
  surveyDateInRange,
  unmatchedSurveyException,
  type HonorariumAging,
  type PipelineDerivationInput,
  type PipelinePaymentRef,
} from './payment-pipeline.contract';

const DAY = 86_400_000;
const AS_OF = new Date('2026-10-27T12:00:00.000Z');

function input(
  overrides: Partial<PipelineDerivationInput> = {},
): PipelineDerivationInput {
  return {
    registrationStatus: 'APPROVED',
    attendanceStatus: 'VERIFIED',
    surveyCompletedAt: new Date('2026-10-01T12:00:00.000Z'),
    payoutProfileComplete: true,
    honorariumRequestedAt: new Date('2026-10-02T12:00:00.000Z'),
    honorariumAmountCents: 50_000,
    payments: [],
    ...overrides,
  };
}

function pay(overrides: Partial<PipelinePaymentRef> = {}): PipelinePaymentRef {
  return {
    status: 'PENDING',
    amountCents: 50_000,
    ...overrides,
  };
}

describe('SCRUM-292 pipeline contract', () => {
  it('lists every ticket status once, in funnel order', () => {
    expect(PIPELINE_STATUSES).toEqual([
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
    ]);
    expect(new Set(PIPELINE_STATUSES).size).toBe(PIPELINE_STATUSES.length);
  });

  it('derives each primary status', () => {
    expect(derivePipelineStatus(input({ registrationStatus: 'PENDING', attendanceStatus: null, surveyCompletedAt: null, payoutProfileComplete: false, honorariumRequestedAt: null }))).toBe('registered');
    expect(derivePipelineStatus(input({ registrationStatus: 'SURVEY_SUBMITTED', attendanceStatus: null, surveyCompletedAt: null, payoutProfileComplete: false, honorariumRequestedAt: null }))).toBe('registered');
    expect(derivePipelineStatus(input({ registrationStatus: 'WAITLISTED', attendanceStatus: null, surveyCompletedAt: null, payoutProfileComplete: false, honorariumRequestedAt: null }))).toBe('registered');
    expect(derivePipelineStatus(input({ attendanceStatus: 'PENDING_VERIFICATION', surveyCompletedAt: null, payoutProfileComplete: false, honorariumRequestedAt: null }))).toBe('approved');
    expect(derivePipelineStatus(input({ attendanceStatus: 'DENIED', surveyCompletedAt: null, payoutProfileComplete: false, honorariumRequestedAt: null }))).toBe('approved');
    expect(derivePipelineStatus(input({ surveyCompletedAt: null, payoutProfileComplete: false, honorariumRequestedAt: null }))).toBe('attended');
    expect(derivePipelineStatus(input({ attendanceStatus: 'NOT_REQUIRED', surveyCompletedAt: null, payoutProfileComplete: false, honorariumRequestedAt: null }))).toBe('attended');
    expect(derivePipelineStatus(input({ payoutProfileComplete: false, honorariumRequestedAt: null }))).toBe('survey_completed');
    expect(derivePipelineStatus(input({ honorariumRequestedAt: null }))).toBe('payment_info_on_file');
    expect(derivePipelineStatus(input({ honorariumAmountCents: 0 }))).toBe('payment_info_on_file');
    expect(derivePipelineStatus(input())).toBe('payment_eligible');
    expect(derivePipelineStatus(input({ payments: [pay({ status: 'PENDING' })] }))).toBe('release_pending');
    expect(derivePipelineStatus(input({ payments: [pay({ status: 'PROCESSING' })] }))).toBe('release_pending');
    expect(derivePipelineStatus(input({ payments: [pay({ status: 'PAID', amountCents: 12_500 })] }))).toBe('paid');
    expect(derivePipelineStatus(input({ payments: [pay({ status: 'FAILED' })] }))).toBe('failed');
    expect(derivePipelineStatus(input({ payments: [pay({ held: true, holdReason: 'finance review' })] }))).toBe('on_hold');
  });

  it('omits rejected and missing registrations', () => {
    expect(derivePipelineStatus(input({ registrationStatus: 'REJECTED' }))).toBeNull();
    expect(derivePipelineStatus(input({ registrationStatus: null }))).toBeNull();
  });

  it('ignores cancelled payments and lets paid beat failed and hold', () => {
    expect(
      derivePipelineStatus(
        input({ payments: [pay({ status: 'CANCELLED' })] }),
      ),
    ).toBe('payment_eligible');
    expect(
      derivePipelineStatus(
        input({
          payments: [
            pay({ status: 'FAILED' }),
            pay({ status: 'PAID', held: true }),
          ],
        }),
      ),
    ).toBe('paid');
    expect(
      derivePipelineStatus(
        input({
          payments: [pay({ status: 'FAILED' }), pay({ status: 'PENDING', held: true })],
        }),
      ),
    ).toBe('on_hold');
  });

  it('does not treat unrequested profile-complete rows as eligible', () => {
    expect(derivePipelineStatus(input({ honorariumRequestedAt: null }))).toBe(
      'payment_info_on_file',
    );
    expect(
      derivePipelineStatus(
        input({ payoutProfileComplete: false, honorariumRequestedAt: new Date() }),
      ),
    ).toBe('survey_completed');
  });

  it('counts every status including zeros', () => {
    const counts = countPipelineStatuses(['paid', 'paid', null, 'failed']);
    expect(counts).toHaveLength(PIPELINE_STATUSES.length);
    expect(counts.find((c) => c.status === 'paid')?.count).toBe(2);
    expect(counts.find((c) => c.status === 'failed')?.count).toBe(1);
    expect(counts.find((c) => c.status === 'registered')?.count).toBe(0);
  });

  it('commits eligible, pending, hold, failed, and paid only', () => {
    expect([...COMMITTED_PIPELINE_STATUSES]).toEqual([
      'payment_eligible',
      'release_pending',
      'on_hold',
      'failed',
      'paid',
    ]);
    const eligible = pipelineRowTotals('payment_eligible', 50_000);
    const paid = pipelineRowTotals('paid', 40_000, true);
    const paidWithoutTransfer = pipelineRowTotals('paid', 15_000, false);
    const info = pipelineRowTotals('payment_info_on_file', 50_000);
    expect(eligible).toEqual({
      committedCents: 50_000,
      releasedCents: 0,
      outstandingCents: 50_000,
    });
    expect(paid).toEqual({
      committedCents: 40_000,
      releasedCents: 40_000,
      outstandingCents: 0,
    });
    expect(paidWithoutTransfer).toEqual({
      committedCents: 15_000,
      releasedCents: 0,
      outstandingCents: 15_000,
    });
    expect(
      providerReleasedCents([
        { status: 'paid', amountCents: 40_000, stripeTransferId: 'tr_a' },
        { status: 'paid', amountCents: 15_000, stripeTransferId: null },
        { status: 'paid', amountCents: 20_000, stripeTransferId: '  ' },
        { status: 'failed', amountCents: 10_000, stripeTransferId: 'tr_fail' },
      ]),
    ).toBe(40_000);
    expect(info.committedCents).toBe(0);
    expect(
      sumPipelineTotals([eligible, paid, pipelineRowTotals('failed', 10_000)]),
    ).toEqual({
      committedCents: 100_000,
      releasedCents: 40_000,
      outstandingCents: 60_000,
    });
  });

  it('uses the provider amount when a payment exists', () => {
    expect(
      pipelineAmountCents(
        input({ payments: [pay({ status: 'PAID', amountCents: 12_500 })] }),
      ),
    ).toBe(12_500);
    expect(pipelineAmountCents(input({ payments: [] }))).toBe(50_000);
    expect(
      pipelineAmountCents(
        input({ payments: [pay({ status: 'CANCELLED', amountCents: 1 })] }),
      ),
    ).toBe(50_000);
  });

  it('flags at-risk inside the window and overdue past it', () => {
    expect(DEFAULT_HONORARIUM_WINDOW_DAYS).toBe(30);
    expect(DEFAULT_HONORARIUM_AT_RISK_DAYS).toBe(21);
    const survey = new Date(AS_OF.getTime() - 21 * DAY);
    expect(
      agingFromSurvey({ surveyCompletedAt: survey, asOf: AS_OF }),
    ).toMatchObject({ daysSinceSurvey: 21, atRisk: true, overdue: false });
    expect(
      agingFromSurvey({
        surveyCompletedAt: new Date(AS_OF.getTime() - 30 * DAY),
        asOf: AS_OF,
      }),
    ).toMatchObject({ daysSinceSurvey: 30, atRisk: true, overdue: false });
    expect(
      agingFromSurvey({
        surveyCompletedAt: new Date(AS_OF.getTime() - 22 * DAY),
        asOf: AS_OF,
        windowDays: 30,
        atRiskDays: 21,
      }),
    ).toMatchObject({ daysSinceSurvey: 22, atRisk: true, overdue: false });
    expect(
      agingFromSurvey({
        surveyCompletedAt: new Date(AS_OF.getTime() - 31 * DAY),
        asOf: AS_OF,
      }),
    ).toMatchObject({ daysSinceSurvey: 31, atRisk: false, overdue: true });
    expect(
      agingFromSurvey({
        surveyCompletedAt: new Date(AS_OF.getTime() - 20 * DAY),
        asOf: AS_OF,
      }).atRisk,
    ).toBe(false);
    expect(agingFromSurvey({ surveyCompletedAt: null, asOf: AS_OF })).toEqual({
      daysSinceSurvey: null,
      atRisk: false,
      overdue: false,
    });
  });

  it('rejects a window outside 1–30 or an at-risk day past the window', () => {
    expect(() => assertHonorariumWindow(0, 1)).toThrow(/window/);
    expect(() => assertHonorariumWindow(31, 21)).toThrow(/window/);
    expect(() => assertHonorariumWindow(30, 31)).toThrow(/at-risk/);
    expect(() =>
      agingFromSurvey({
        surveyCompletedAt: AS_OF,
        asOf: AS_OF,
        windowDays: 14,
        atRiskDays: 15,
      }),
    ).toThrow(/at-risk/);
  });

  it('applies an inclusive survey date range and drops undated rows when bounded', () => {
    const survey = new Date('2026-10-10T00:00:00.000Z');
    const from = new Date('2026-10-01T00:00:00.000Z');
    const to = new Date('2026-10-20T00:00:00.000Z');
    expect(surveyDateInRange(survey, from, to)).toBe(true);
    expect(surveyDateInRange(survey, null, null)).toBe(true);
    expect(surveyDateInRange(null, from, null)).toBe(false);
    expect(surveyDateInRange(new Date('2026-09-01T00:00:00.000Z'), from, to)).toBe(
      false,
    );
  });

  it('attaches exception codes and suggested actions', () => {
    expect(deriveExceptionCodes(input({ payoutProfileComplete: false, honorariumRequestedAt: null }), 'survey_completed')).toEqual([
      'missing_payment_details',
    ]);
    expect(
      deriveExceptionCodes(input({ payments: [pay({ status: 'FAILED' })] }), 'failed'),
    ).toEqual(['provider_error']);
    expect(
      deriveExceptionCodes(
        input({
          payments: [pay({ status: 'PAID' }), pay({ status: 'FAILED' })],
        }),
        'paid',
      ),
    ).toEqual(['duplicate_payouts']);
    expect(unmatchedSurveyException()).toEqual(['survey_unmatched']);
    expect(pipelineFailureReason([pay({ status: 'FAILED', failureReason: '  bank closed  ' })])).toBe(
      'bank closed',
    );
    const items = pipelineExceptionItems([
      {
        programId: 'p',
        programTitle: 'Webinar',
        userId: 'u',
        userName: 'Ada',
        userEmail: 'ada@example.com',
        exceptions: ['provider_error', 'duplicate_payouts'],
        failureReason: 'bank closed',
      },
    ]);
    expect(items.map((item) => item.action)).toEqual([
      PIPELINE_EXCEPTION_ACTIONS.provider_error,
      PIPELINE_EXCEPTION_ACTIONS.duplicate_payouts,
    ]);
    expect(items[0]?.failureReason).toBe('bank closed');
    expect(items[1]?.failureReason).toBeNull();
    expect(
      unmatchedSurveyExceptionItem({
        surveyResponseId: 'sr-1',
        programId: 'p',
        programTitle: 'Webinar',
        userName: null,
        userEmail: null,
      }).action,
    ).toBe(PIPELINE_EXCEPTION_ACTIONS.survey_unmatched);
    for (const code of PIPELINE_EXCEPTION_CODES) {
      expect(PIPELINE_EXCEPTION_ACTIONS[code].length).toBeGreaterThan(0);
    }
  });

  it('matches name or email and ignores a blank query', () => {
    expect(matchesPersonQuery('Ada Lovelace', 'ada@example.com', 'love')).toBe(true);
    expect(matchesPersonQuery('Ada Lovelace', 'ada@example.com', 'ADA@')).toBe(true);
    expect(matchesPersonQuery('Ada Lovelace', 'ada@example.com', 'bob')).toBe(false);
    expect(matchesPersonQuery('Ada Lovelace', 'ada@example.com', '  ')).toBe(true);
  });

  it('freezes audit actions and a CSV without account numbers', () => {
    expect(PAYMENT_AUDIT_ACTIONS).toEqual([
      'payment.release',
      'payment.retry',
      'payment.delete',
      'payment.manual_create',
      'payment.edit',
      'payment.hold',
      'payment.release_hold',
    ]);
    expect(PIPELINE_CSV_COLUMNS).toEqual(
      expect.arrayContaining([
        'pipelineStatus',
        'amountCents',
        'stripeTransferId',
        'stripePayoutId',
        'holdReason',
        'daysSinceSurvey',
        'atRisk',
      ]),
    );
    for (const forbidden of PIPELINE_CSV_FORBIDDEN_COLUMNS) {
      expect(PIPELINE_CSV_COLUMNS as readonly string[]).not.toContain(forbidden);
    }
    expect(pipelineCsvHeader().split(',')).toEqual([...PIPELINE_CSV_COLUMNS]);
    const csv = pipelineCsv([
      {
        status: 'paid',
        amountCents: 40_000,
        programId: 'prog-1',
        programTitle: 'Cardiology, webinar',
        userName: 'Ada "A" Lovelace',
        userEmail: 'ada@example.com',
        surveyCompletedAt: '2026-10-01T12:00:00.000Z',
        aging: { daysSinceSurvey: 22, atRisk: true, overdue: false },
        stripeTransferId: 'tr_paid',
        stripePayoutId: 'po_paid',
        holdReason: null,
      },
      {
        status: 'payment_eligible',
        amountCents: 50_000,
        programId: 'prog-1',
        programTitle: 'Cardiology webinar',
        userName: 'Grace Hopper',
        userEmail: 'grace@example.com',
        surveyCompletedAt: '2026-10-02T12:00:00.000Z',
        aging: { daysSinceSurvey: 21, atRisk: true, overdue: false },
        stripeTransferId: null,
        stripePayoutId: null,
        holdReason: 'waiting, on W-9',
      },
    ]);
    const [header, paidLine, eligibleLine] = csv.split('\n');
    expect(header).toBe(pipelineCsvHeader());
    expect(header).toContain('stripeTransferId');
    expect(header).toContain('amountCents');
    expect(header).toContain('amountDollars');
    for (const forbidden of PIPELINE_CSV_FORBIDDEN_COLUMNS) {
      expect(header.split(',')).not.toContain(forbidden);
    }
    expect(paidLine).toContain('tr_paid');
    expect(paidLine).toContain('po_paid');
    expect(paidLine).toContain('40000');
    expect(paidLine).toContain('400.00');
    expect(paidLine).toContain('"Cardiology, webinar"');
    expect(paidLine).toContain('"Ada ""A"" Lovelace"');
    expect(eligibleLine).toContain('grace@example.com');
    expect(eligibleLine).toContain('"waiting, on W-9"');
    expect(csv).not.toContain('accountNumber');
    expect(PIPELINE_QUERY).toEqual({
      programId: 'programId',
      status: 'status',
      from: 'from',
      to: 'to',
      q: 'q',
    });
  });

  it('reads hold reason and provider refs from the status-owning payment', () => {
    const payments = [
      pay({ status: 'FAILED', stripeTransferId: 'tr_fail', amountCents: 1 }),
      pay({
        status: 'PAID',
        amountCents: 9,
        stripeTransferId: 'tr_ok',
        stripePayoutId: 'po_ok',
      }),
    ];
    expect(pipelineProviderRefs(payments)).toEqual({
      stripeTransferId: 'tr_ok',
      stripePayoutId: 'po_ok',
    });
    expect(
      pipelineHoldReason([
        pay({ held: true, holdReason: '  waiting on W-9  ' }),
      ]),
    ).toBe('waiting on W-9');
    expect(pipelineHoldReason([])).toBeNull();
  });

  it('marks the first honorarium confirmation new and a later one reused', () => {
    expect(payoutDetailsOriginForRequest(0)).toBe('new');
    expect(payoutDetailsOriginForRequest(1)).toBe('reused');
    expect(normalizePayoutDetailsOrigin('NEW')).toBe('new');
    expect(normalizePayoutDetailsOrigin('NEWLY_ENTERED')).toBe('new');
    expect(normalizePayoutDetailsOrigin('REUSED')).toBe('reused');
    expect(normalizePayoutDetailsOrigin(null)).toBeNull();
    expect(normalizePayoutDetailsOrigin('unknown')).toBeNull();
  });

  it('lists overdue unpaid rows and leaves paid rows out', () => {
    const aging = (days: number, overdue: boolean): HonorariumAging => ({
      daysSinceSurvey: days,
      atRisk: false,
      overdue,
    });
    const rows = overdueUnpaidRows([
      { status: 'paid' as const, aging: aging(40, true) },
      { status: 'payment_eligible' as const, aging: aging(31, true) },
      { status: 'failed' as const, aging: aging(45, true) },
      { status: 'survey_completed' as const, aging: aging(68, true) },
      { status: 'release_pending' as const, aging: aging(22, false) },
    ]);
    expect(rows.map((row) => row.status)).toEqual([
      'survey_completed',
      'failed',
      'payment_eligible',
    ]);
    expect(isUnpaidHonorariumStatus('paid')).toBe(false);
    expect(isUnpaidHonorariumStatus('on_hold')).toBe(true);
  });

  it('prefixes spreadsheet formulas in the finance CSV', () => {
    const csv = pipelineCsv([
      {
        status: 'payment_eligible',
        amountCents: 100,
        programId: 'prog-1',
        programTitle: 'Webinar',
        userName: '=cmd|" /C calc"!A0',
        userEmail: 'ada@example.com',
        surveyCompletedAt: null,
        aging: { daysSinceSurvey: 1, atRisk: false, overdue: false },
        stripeTransferId: null,
        stripePayoutId: null,
        holdReason: null,
      },
    ]);
    expect(csv).toContain(`"'=cmd|"" /C calc""!A0"`);
    expect(csv.startsWith('=')).toBe(false);
  });
});
