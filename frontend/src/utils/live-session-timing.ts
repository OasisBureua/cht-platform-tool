/** Default length when program.duration is missing (minutes). */
export const LIVE_SESSION_DEFAULT_DURATION_MIN = 90;

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
