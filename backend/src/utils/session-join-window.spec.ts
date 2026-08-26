import {
  LIVE_JOIN_EARLY_MS,
  resolveLiveJoinWindow,
} from './session-join-window';

describe('resolveLiveJoinWindow', () => {
  const start = new Date('2026-08-01T18:00:00.000Z');

  it('blocks when startDate is missing', () => {
    const w = resolveLiveJoinWindow(null, 60, start);
    expect(w.canJoin).toBe(false);
    expect(w.opensAt).toBeNull();
  });

  it('blocks more than 15 minutes before start', () => {
    const now = new Date(start.getTime() - LIVE_JOIN_EARLY_MS - 60_000);
    const w = resolveLiveJoinWindow(start, 60, now);
    expect(w.canJoin).toBe(false);
    expect(w.opensAt).toBe(
      new Date(start.getTime() - LIVE_JOIN_EARLY_MS).toISOString(),
    );
  });

  it('allows join inside the early window', () => {
    const now = new Date(start.getTime() - LIVE_JOIN_EARLY_MS + 30_000);
    const w = resolveLiveJoinWindow(start, 60, now);
    expect(w.canJoin).toBe(true);
  });

  it('allows join during the session', () => {
    const now = new Date(start.getTime() + 10 * 60_000);
    const w = resolveLiveJoinWindow(start, 60, now);
    expect(w.canJoin).toBe(true);
  });

  it('blocks after the session ends', () => {
    const now = new Date(start.getTime() + 61 * 60_000);
    const w = resolveLiveJoinWindow(start, 60, now);
    expect(w.canJoin).toBe(false);
    expect(w.reason).toMatch(/ended/i);
  });
});
