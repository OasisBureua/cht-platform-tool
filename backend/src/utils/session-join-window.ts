/** How early an approved learner may open the Zoom join link. */
export const LIVE_JOIN_EARLY_MS = 15 * 60 * 1000;

/** Fallback session length when program.duration is missing (minutes). */
export const LIVE_JOIN_DEFAULT_DURATION_MIN = 90;

export type LiveJoinWindow = {
  /** Absolute URL may be shown / used. */
  canJoin: boolean;
  /** ISO time when the join link becomes available (null if no startDate). */
  opensAt: string | null;
  /** ISO time when the join window ends (null if no startDate). */
  closesAt: string | null;
  /** Short reason when canJoin is false. */
  reason: string | null;
};

/**
 * Gate live-session join links to a window around the scheduled start.
 * Without a startDate, join stays closed (admins still use host start URL).
 */
export function resolveLiveJoinWindow(
  startDate: Date | string | null | undefined,
  durationMinutes: number | null | undefined,
  now: Date = new Date(),
): LiveJoinWindow {
  if (!startDate) {
    return {
      canJoin: false,
      opensAt: null,
      closesAt: null,
      reason: 'Session start time is not scheduled yet.',
    };
  }

  const start =
    startDate instanceof Date ? startDate : new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return {
      canJoin: false,
      opensAt: null,
      closesAt: null,
      reason: 'Session start time is invalid.',
    };
  }

  const duration =
    typeof durationMinutes === 'number' &&
    Number.isFinite(durationMinutes) &&
    durationMinutes > 0
      ? durationMinutes
      : LIVE_JOIN_DEFAULT_DURATION_MIN;

  const opens = new Date(start.getTime() - LIVE_JOIN_EARLY_MS);
  const closes = new Date(start.getTime() + duration * 60_000);
  const opensAt = opens.toISOString();
  const closesAt = closes.toISOString();

  if (now.getTime() < opens.getTime()) {
    return {
      canJoin: false,
      opensAt,
      closesAt,
      reason: `Join opens ${formatJoinOpensLabel(opens)}.`,
    };
  }
  if (now.getTime() > closes.getTime()) {
    return {
      canJoin: false,
      opensAt,
      closesAt,
      reason: 'This live session has ended.',
    };
  }
  return { canJoin: true, opensAt, closesAt, reason: null };
}

function formatJoinOpensLabel(opens: Date): string {
  try {
    return opens.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/New_York',
    });
  } catch {
    return opens.toISOString();
  }
}
