/** Default length when program.duration is missing (minutes). */
export const LIVE_SESSION_DEFAULT_DURATION_MIN = 90;

/**
 * Extra minutes after scheduled end before post-event unlock when Zoom
 * session-ended webhook has not fired yet.
 */
export const POST_EVENT_SCHEDULED_END_BUFFER_MIN = 15;

export function sessionEndsAt(
  startTime: string | Date,
  durationMinutes?: number | null,
): Date {
  const start =
    startTime instanceof Date ? startTime : new Date(startTime);
  const mins =
    typeof durationMinutes === 'number' &&
    Number.isFinite(durationMinutes) &&
    durationMinutes > 0
      ? durationMinutes
      : LIVE_SESSION_DEFAULT_DURATION_MIN;
  return new Date(start.getTime() + mins * 60_000);
}

/** Scheduled end + buffer — used only when webhook end time is absent. */
export function scheduledPostEventUnlockAt(
  startTime: string | Date,
  durationMinutes?: number | null,
): Date {
  return new Date(
    sessionEndsAt(startTime, durationMinutes).getTime() +
      POST_EVENT_SCHEDULED_END_BUFFER_MIN * 60_000,
  );
}

/** True only after start + duration (session has fully ended). */
export function isSessionExpired(
  startTime?: string | Date | null,
  durationMinutes?: number | null,
  now: Date = new Date(),
): boolean {
  if (!startTime) return false;
  const start =
    startTime instanceof Date ? startTime : new Date(startTime);
  if (Number.isNaN(start.getTime())) return false;
  return now.getTime() >= sessionEndsAt(start, durationMinutes).getTime();
}

/** HCPs may not register once the scheduled start time has been reached. */
export function isRegistrationClosed(
  startTime?: string | Date | null,
  now: Date = new Date(),
): boolean {
  if (!startTime) return false;
  const start =
    startTime instanceof Date ? startTime : new Date(startTime);
  if (Number.isNaN(start.getTime())) return false;
  return now.getTime() >= start.getTime();
}
