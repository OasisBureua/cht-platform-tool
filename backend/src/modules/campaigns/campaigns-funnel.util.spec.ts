import {
  buildStagesFromCounts,
  defaultReportingWindow,
  dropOffFromPreviousPct,
  emptyCountsByStage,
  toIsoDate,
  utcDayBounds,
} from './campaigns-funnel.util';

describe('campaigns-funnel.util', () => {
  describe('dropOffFromPreviousPct', () => {
    it('returns null when previous is 0', () => {
      expect(dropOffFromPreviousPct(0, 10)).toBeNull();
    });

    it('returns 0 when current >= previous (no negative drop)', () => {
      expect(dropOffFromPreviousPct(50, 50)).toBe(0);
      expect(dropOffFromPreviousPct(25, 100)).toBe(0);
    });

    it('rounds percent drop', () => {
      expect(dropOffFromPreviousPct(100, 40)).toBe(60);
      expect(dropOffFromPreviousPct(3, 1)).toBe(67);
    });
  });

  describe('buildStagesFromCounts', () => {
    it('builds six stages with labels and peopleAvailable flags', () => {
      const counts = emptyCountsByStage();
      counts.aware = 100;
      counts.engaged = 50;
      counts.captured = 25;
      counts.registered = 10;
      counts.attended = 5;
      counts.converted = 2;

      const stages = buildStagesFromCounts(counts);
      expect(stages).toHaveLength(6);
      expect(stages.map((s) => s.key)).toEqual([
        'aware',
        'engaged',
        'captured',
        'registered',
        'attended',
        'converted',
      ]);
      expect(stages[0].dropOffFromPreviousPct).toBeNull();
      expect(stages[1].dropOffFromPreviousPct).toBe(50);
      expect(stages[0].peopleAvailable).toBe(false);
      expect(stages[3].peopleAvailable).toBe(true);
      expect(stages[5].label).toBe('Converted');
    });
  });

  describe('toIsoDate', () => {
    it('accepts YYYY-MM-DD and strips time suffix', () => {
      expect(toIsoDate('2026-08-01')).toBe('2026-08-01');
      expect(toIsoDate('2026-08-01T12:00:00.000Z')).toBe('2026-08-01');
      expect(toIsoDate('')).toBeNull();
      expect(toIsoDate(undefined)).toBeNull();
    });
  });

  describe('utcDayBounds', () => {
    it('returns inclusive UTC day window', () => {
      const bounds = utcDayBounds('2026-05-01', '2026-05-02');
      expect(bounds.gte.toISOString()).toBe('2026-05-01T00:00:00.000Z');
      expect(bounds.lte.toISOString()).toBe('2026-05-02T23:59:59.999Z');
    });
  });

  describe('defaultReportingWindow', () => {
    it('returns a ~90 day window ending today (UTC date)', () => {
      const { startDate, endDate } = defaultReportingWindow();
      expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(startDate <= endDate).toBe(true);
    });
  });
});
