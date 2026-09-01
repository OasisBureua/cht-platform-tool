import {
  buildMonthWindows,
  formatZoomApiDate,
  parseZoomApiDate,
  syncWindowFromMonthsBack,
} from './zoom-sync-date.util';

describe('formatZoomApiDate / parseZoomApiDate', () => {
  it('formats UTC dates as YYYY-MM-DD', () => {
    expect(formatZoomApiDate(new Date('2025-03-05T15:00:00Z'))).toBe('2025-03-05');
  });

  it('round-trips parse', () => {
    const d = parseZoomApiDate('2024-12-01');
    expect(formatZoomApiDate(d)).toBe('2024-12-01');
  });
});

describe('syncWindowFromMonthsBack', () => {
  it('returns an inclusive range ending today UTC', () => {
    const now = new Date('2026-08-28T12:00:00Z');
    const { fromDate, toDate } = syncWindowFromMonthsBack(24, now);
    expect(formatZoomApiDate(toDate)).toBe('2026-08-28');
    expect(formatZoomApiDate(fromDate)).toBe('2024-08-28');
  });

  it('clamps months to 1–120', () => {
    const now = new Date('2026-01-15T00:00:00Z');
    const short = syncWindowFromMonthsBack(0, now);
    expect(formatZoomApiDate(short.fromDate)).toBe('2025-12-15');
    const long = syncWindowFromMonthsBack(999, now);
    expect(formatZoomApiDate(long.fromDate)).toBe('2016-01-15');
  });
});

describe('buildMonthWindows', () => {
  it('splits a multi-month range into calendar month slices', () => {
    const windows = buildMonthWindows(
      parseZoomApiDate('2025-01-15'),
      parseZoomApiDate('2025-03-10'),
    );
    expect(windows).toEqual([
      { from: '2025-01-15', to: '2025-01-31' },
      { from: '2025-02-01', to: '2025-02-28' },
      { from: '2025-03-01', to: '2025-03-10' },
    ]);
  });

  it('returns one window for a range inside a single month', () => {
    expect(
      buildMonthWindows(
        parseZoomApiDate('2025-06-01'),
        parseZoomApiDate('2025-06-20'),
      ),
    ).toEqual([{ from: '2025-06-01', to: '2025-06-20' }]);
  });

  it('returns empty array when from is after to', () => {
    expect(
      buildMonthWindows(
        parseZoomApiDate('2025-06-02'),
        parseZoomApiDate('2025-06-01'),
      ),
    ).toEqual([]);
  });
});
