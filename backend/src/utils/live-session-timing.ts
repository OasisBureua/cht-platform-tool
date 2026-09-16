/** Default length when program.duration is missing (minutes). */
export const LIVE_SESSION_DEFAULT_DURATION_MIN = 90;

/**
 * Extra minutes after scheduled end before post-event unlock when Zoom
 * `zoomSessionEndedAt` is not set (avoids early survey gate / re-entry blocks).
 */
export const POST_EVENT_SCHEDULED_END_BUFFER_MIN = 15;

export function scheduledSessionEndMs(
  startMs: number,
  durationMinutes?: number | null,
): number {
  const mins =
    typeof durationMinutes === 'number' &&
    Number.isFinite(durationMinutes) &&
    durationMinutes > 0
      ? durationMinutes
      : LIVE_SESSION_DEFAULT_DURATION_MIN;
  return startMs + mins * 60_000;
}

/** Scheduled end + buffer — used only when webhook end time is absent. */
export function scheduledPostEventUnlockMs(
  startMs: number,
  durationMinutes?: number | null,
): number {
  return (
    scheduledSessionEndMs(startMs, durationMinutes) +
    POST_EVENT_SCHEDULED_END_BUFFER_MIN * 60_000
  );
}
