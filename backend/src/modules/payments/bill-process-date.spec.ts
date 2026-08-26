import {
  isBillProcessDateRetryable,
  nextUsWeekdayIsoDate,
  twoUsWeekdaysOutIsoDate,
  summarizeBillError,
} from './bill-process-date';

describe('bill-process-date', () => {
  it('skips Saturday and Sunday for the next weekday', () => {
    // Friday 21 Aug 2026 UTC → Monday 24 Aug
    expect(nextUsWeekdayIsoDate(new Date('2026-08-21T21:19:50.000Z'))).toBe(
      '2026-08-24',
    );
    expect(nextUsWeekdayIsoDate(new Date('2026-08-22T12:00:00.000Z'))).toBe(
      '2026-08-24',
    );
    expect(nextUsWeekdayIsoDate(new Date('2026-08-24T12:00:00.000Z'))).toBe(
      '2026-08-25',
    );
  });

  it('computes two weekdays out from Friday as Tuesday', () => {
    expect(twoUsWeekdaysOutIsoDate(new Date('2026-08-21T21:19:50.000Z'))).toBe(
      '2026-08-25',
    );
  });

  it('detects Bill process-date errors for retry', () => {
    expect(
      isBillProcessDateRetryable(
        new Error(
          'Bill.com API error (422): [{"code":"BDC_1152","message":"Invalid Process Date : ${paramName0}."}]',
        ),
      ),
    ).toBe(true);
    expect(
      isBillProcessDateRetryable(
        new Error(
          'Bill.com API error (400): Please select a payment processing date two business days out from today. BDC_1402',
        ),
      ),
    ).toBe(true);
    expect(isBillProcessDateRetryable(new Error('BDC_1361 untrusted'))).toBe(
      false,
    );
  });
});

describe('summarizeBillError', () => {
  it('collapses Bill JSON into code + message without param placeholders', () => {
    const err = new Error(
      'Bill.com API error (422): [{"timestamp":"2026-08-21T21:19:50.992+00:00","code":"BDC_1152","severity":"ERROR","category":"DOWNSTREAM","message":"Invalid Process Date : ${paramName0}."},{"timestamp":"2026-08-21T21:19:50.992+00:00","code":"BDC_1152","severity":"ERROR","category":"DOWNSTREAM","message":"00n02YCLZFIWZX3ruxj4 : Invalid Process Date : ${paramName0}."}]',
    );
    expect(summarizeBillError(err)).toBe(
      'Bill.com (422): BDC_1152: Invalid Process Date.',
    );
  });

  it('passes through non-Bill errors trimmed', () => {
    expect(summarizeBillError(new Error('User does not have a Bill.com vendor account'))).toBe(
      'User does not have a Bill.com vendor account',
    );
  });
});
