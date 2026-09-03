import { describe, expect, it } from 'vitest';
import { zoomSyncProgressDisplay } from '../../components/admin/zoom-recordings/zoomSyncProgress';

describe('zoomSyncProgressDisplay', () => {
  it('uses host × month windows for percent when present', () => {
    const result = zoomSyncProgressDisplay({
      monthsTotal: 2,
      monthsDone: 1,
      usersTotal: 10,
      usersDone: 3,
      windowsTotal: 20,
      windowsDone: 7,
      sessionsUpserted: 0,
      fileStubsUpserted: 0,
      errors: [],
    });
    expect(result.pct).toBe(35);
    expect(result.label).toContain('3/10 hosts');
    expect(result.label).toContain('7/20 windows');
    expect(result.label).not.toContain('1/2 months');
  });

  it('returns empty display when progress is missing', () => {
    expect(zoomSyncProgressDisplay(null)).toEqual({
      pct: null,
      label: undefined,
    });
  });

  it('falls back to hosts when windows are absent', () => {
    const result = zoomSyncProgressDisplay({
      monthsTotal: 24,
      monthsDone: 2,
      usersTotal: 8,
      usersDone: 4,
      sessionsUpserted: 0,
      fileStubsUpserted: 0,
      errors: [],
    });
    expect(result.pct).toBe(50);
    expect(result.label).toContain('4/8 hosts');
  });

  it('falls back to months-only for older jobs', () => {
    const result = zoomSyncProgressDisplay({
      monthsTotal: 25,
      monthsDone: 5,
      sessionsUpserted: 0,
      fileStubsUpserted: 0,
      errors: [],
    });
    expect(result.pct).toBe(20);
    expect(result.label).toBe('5/25 months (20%)');
  });
});
