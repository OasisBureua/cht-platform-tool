import {
  pipelineRowsForStatus,
  pipelineTimelineItems,
  pipelineExceptionSummary,
  normalizePaymentPipeline,
  bulkPaymentRequest,
  localDayBoundIso,
  pipelineExportParams,
  unpaidDaysLabel,
  type PaymentPipelineRow,
} from '../../api/admin';

function row(
  status: PaymentPipelineRow['status'],
  userId: string,
  extras: Partial<PaymentPipelineRow> = {},
): PaymentPipelineRow {
  return {
    status,
    programId: 'p1',
    programTitle: 'Webinar',
    userId,
    userName: userId,
    userEmail: `${userId}@example.com`,
    amountCents: 1000,
    surveyCompletedAt: null,
    aging: { daysSinceSurvey: null, atRisk: false, overdue: false },
    payoutDetailsOrigin: null,
    paymentDetailsConfirmedAt: null,
    attendanceRecordedAt: null,
    releaseAt: null,
    stripeTransferId: null,
    stripePayoutId: null,
    holdReason: null,
    totals: { committedCents: 0, releasedCents: 0, outstandingCents: 0 },
    ...extras,
  };
}

describe('pipelineRowsForStatus', () => {
  const rows = [
    row('payment_eligible', 'a'),
    row('paid', 'b'),
    row('payment_eligible', 'c'),
  ];

  it('returns only the clicked status', () => {
    expect(pipelineRowsForStatus(rows, 'payment_eligible').map((r) => r.userId)).toEqual([
      'a',
      'c',
    ]);
    expect(pipelineRowsForStatus(rows, 'paid').every((r) => r.status === 'paid')).toBe(true);
    expect(pipelineRowsForStatus(rows, 'failed')).toEqual([]);
  });

  it('returns every row when no status is selected', () => {
    expect(pipelineRowsForStatus(rows, null)).toHaveLength(3);
  });
});

describe('pipelineTimelineItems', () => {
  const paid = row('paid', 'b', {
    attendanceRecordedAt: '2026-09-30T12:00:00.000Z',
    surveyCompletedAt: '2026-10-01T12:00:00.000Z',
    paymentDetailsConfirmedAt: '2026-10-02T12:00:00.000Z',
    payoutDetailsOrigin: 'reused',
    releaseAt: '2026-10-20T00:00:00.000Z',
    stripeTransferId: 'tr_paid',
    stripePayoutId: 'po_paid',
  });

  it('shows every date and the provider reference on a paid row', () => {
    const items = pipelineTimelineItems(paid);
    expect(items.map((item) => item.label)).toEqual([
      'Attendance recorded',
      'Survey submitted',
      'Payment details confirmed',
      'Release date',
      'Provider reference',
    ]);
    expect(items.every((item) => item.value !== '—')).toBe(true);
    expect(items.find((item) => item.label === 'Payment details confirmed')?.value).toContain(
      'Reused saved details',
    );
    expect(items.find((item) => item.label === 'Provider reference')?.value).toBe(
      'tr_paid · po_paid',
    );
  });

  it('labels a first confirmation as newly entered', () => {
    const items = pipelineTimelineItems(
      row('payment_eligible', 'a', {
        paymentDetailsConfirmedAt: '2026-10-02T12:00:00.000Z',
        payoutDetailsOrigin: 'new',
      }),
    );
    expect(items.find((item) => item.label === 'Payment details confirmed')?.value).toContain(
      'Newly entered',
    );
  });

  it('leaves older rows without a stored origin as not recorded', () => {
    const items = pipelineTimelineItems(
      row('paid', 'old', { paymentDetailsConfirmedAt: '2026-01-01T00:00:00.000Z' }),
    );
    expect(items.find((item) => item.label === 'Payment details confirmed')?.value).toContain(
      'Not recorded',
    );
    expect(items.find((item) => item.label === 'Provider reference')?.value).toBe('—');
  });
});

describe('unpaidDaysLabel', () => {
  it('shows how long an eligible honorarium has been unpaid', () => {
    expect(
      unpaidDaysLabel(
        row('payment_eligible', 'a', {
          aging: { daysSinceSurvey: 22, atRisk: true, overdue: false },
        }),
      ),
    ).toBe('22 days unpaid');
  });

  it('does not call a paid row unpaid', () => {
    expect(
      unpaidDaysLabel(
        row('paid', 'b', {
          aging: { daysSinceSurvey: 31, atRisk: false, overdue: true },
        }),
      ),
    ).toBeNull();
  });

  it('uses the singular when the survey was yesterday', () => {
    expect(
      unpaidDaysLabel(
        row('failed', 'c', {
          aging: { daysSinceSurvey: 1, atRisk: false, overdue: false },
        }),
      ),
    ).toBe('1 day unpaid');
  });
});

describe('pipelineExceptionSummary', () => {
  it('shows the next action for each exception', () => {
    expect(
      pipelineExceptionSummary({
        code: 'missing_payment_details',
        action: 'Ask the HCP to finish W-9 and payout profile',
        failureReason: null,
      }),
    ).toBe('Missing payment details: Ask the HCP to finish W-9 and payout profile');
    expect(
      pipelineExceptionSummary({
        code: 'provider_error',
        action: 'Retry the payout or fix the Stripe account',
        failureReason: 'bank account closed',
      }),
    ).toBe('Provider error: Retry the payout or fix the Stripe account (bank account closed)');
    expect(
      pipelineExceptionSummary({
        code: 'survey_unmatched',
        action: 'Match the survey response to a user and webinar',
        failureReason: null,
      }),
    ).toContain('Match the survey response to a user and webinar');
    expect(
      pipelineExceptionSummary({
        code: 'duplicate_payouts',
        action: 'Review duplicate payouts before releasing again',
        failureReason: null,
      }),
    ).toContain('Review duplicate payouts before releasing again');
  });
});

describe('pipelineExportParams', () => {
  it('sends the current program, status, survey dates, and name', () => {
    expect(
      pipelineExportParams({
        programId: 'prog-1',
        status: 'paid',
        surveyFrom: '2026-10-01',
        surveyTo: '2026-10-31',
        q: ' ada ',
      }),
    ).toEqual({
      scope: 'pipeline',
      programId: 'prog-1',
      status: 'paid',
      from: localDayBoundIso('2026-10-01', false),
      to: localDayBoundIso('2026-10-31', true),
      q: 'ada',
    });
  });

  it('builds survey day bounds in local time, not UTC midnight', () => {
    const from = localDayBoundIso('2026-10-27', false);
    const to = localDayBoundIso('2026-10-27', true);
    expect(new Date(from).getHours()).toBe(0);
    expect(new Date(from).getMinutes()).toBe(0);
    expect(new Date(to).getHours()).toBe(23);
    expect(new Date(to).getMinutes()).toBe(59);
  });

  it('omits empty filters', () => {
    expect(pipelineExportParams({ q: '   ' })).toEqual({ scope: 'pipeline' });
  });
});

describe('normalizePaymentPipeline', () => {
  it('turns a missing payload into an empty pipeline', () => {
    const empty = normalizePaymentPipeline(undefined);
    expect(empty.rows).toEqual([]);
    expect(empty.exceptions).toEqual([]);
    expect(empty.overdueRows).toEqual([]);
    expect(empty.programs).toEqual([]);
    expect(empty.counts).toHaveLength(10);
    expect(empty.totals).toEqual({
      committedCents: 0,
      releasedCents: 0,
      outstandingCents: 0,
    });
  });

  it('drops broken rows and fills missing totals', () => {
    const pipeline = normalizePaymentPipeline({
      rows: [null, { status: 'paid' }, { status: 'nope', programId: 'p', userId: 'u' }] as never,
      programs: [{ programId: 'p' }] as never,
      exceptions: [null, { code: 'toString' }, { code: 'provider_error' }] as never,
      overdueRows: [{ status: 'failed', programId: 'p', userId: 'u' }] as never,
    });
    expect(pipeline.rows).toEqual([]);
    expect(pipeline.programs[0]?.totals).toEqual({
      committedCents: 0,
      releasedCents: 0,
      outstandingCents: 0,
    });
    expect(pipeline.exceptions).toHaveLength(1);
    expect(pipeline.exceptions[0]?.action).toBe('Review this payment.');
    expect(pipeline.overdueRows[0]?.aging).toEqual({
      daysSinceSurvey: null,
      atRisk: false,
      overdue: false,
    });
    expect(pipeline.counts).toHaveLength(10);
  });

  it('keeps a partial totals object from crashing the page', () => {
    const pipeline = normalizePaymentPipeline({
      totals: { committedCents: 500 } as never,
      rows: undefined,
    });
    expect(pipeline.totals.committedCents).toBe(500);
    expect(pipeline.totals.releasedCents).toBe(0);
    expect(pipeline.rows).toEqual([]);
  });
});

describe('bulkPaymentRequest', () => {
  it('does not build a request until the admin confirms', () => {
    expect(
      bulkPaymentRequest({
        action: 'release',
        paymentIds: ['a', 'b'],
        confirmed: false,
      }),
    ).toBeNull();
  });

  it('requires a hold reason after confirm', () => {
    expect(
      bulkPaymentRequest({
        action: 'hold',
        paymentIds: ['a'],
        reason: '  ',
        confirmed: true,
      }),
    ).toBeNull();
    expect(
      bulkPaymentRequest({
        action: 'hold',
        paymentIds: ['a', 'a'],
        reason: ' finance review ',
        confirmed: true,
      }),
    ).toEqual({ action: 'hold', paymentIds: ['a'], reason: 'finance review' });
  });
});
