/** Post-event Jotform embed. Prefer native survey submit; legacyAttribution adds URL params for Jotform webhooks only. */
export function buildPostEventSurveyEmbedSrc(
  formUrl: string,
  opts?: { legacyAttribution?: boolean; userId?: string; programId?: string },
): string {
  const raw = formUrl.trim();
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (opts?.legacyAttribution) {
      if (opts.userId) u.searchParams.set('user_id', opts.userId);
      if (opts.programId) u.searchParams.set('program_id', opts.programId);
    }
    return u.toString();
  } catch {
    if (!opts?.legacyAttribution) return raw;
    const sep = raw.includes('?') ? '&' : '?';
    const parts: string[] = [];
    if (opts.userId) parts.push(`user_id=${encodeURIComponent(opts.userId)}`);
    if (opts.programId) parts.push(`program_id=${encodeURIComponent(opts.programId)}`);
    if (parts.length === 0) return raw;
    return `${raw}${sep}${parts.join('&')}`;
  }
}

/**
 * Post-event Jotform should appear only after the live session is over.
 * Prefer `zoomSessionEndedAt` from Zoom meeting.ended / webinar.ended webhooks; otherwise scheduled end (webinars only).
 */
export const POST_EVENT_SURVEY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function getPostEventSurveyUnlockMs(program: {
  zoomSessionType?: 'WEBINAR' | 'MEETING';
  startDate?: string | null;
  duration?: number | null;
  zoomSessionEndedAt?: string | null;
}): number | null {
  if (program.zoomSessionEndedAt?.trim()) {
    const t = new Date(program.zoomSessionEndedAt).getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (program.zoomSessionType === 'MEETING') {
    return 0;
  }
  if (!program.startDate?.trim()) {
    return null;
  }
  const start = new Date(program.startDate).getTime();
  if (Number.isNaN(start)) {
    return null;
  }
  const durMin = program.duration ?? 60;
  return start + durMin * 60 * 1000;
}

export function isPostEventSurveyUnlocked(program: {
  zoomSessionType?: 'WEBINAR' | 'MEETING';
  startDate?: string;
  duration?: number;
  zoomSessionEndedAt?: string;
}): boolean {
  const unlockMs = getPostEventSurveyUnlockMs(program);
  if (unlockMs == null) {
    return false;
  }
  return Date.now() >= unlockMs;
}

export function getPostEventSurveyRemainingDays(program: {
  zoomSessionType?: 'WEBINAR' | 'MEETING';
  startDate?: string | null;
  duration?: number | null;
  zoomSessionEndedAt?: string | null;
}): number {
  const unlockMs = getPostEventSurveyUnlockMs(program);
  if (unlockMs == null) {
    return 0;
  }
  const expiresAt = unlockMs + POST_EVENT_SURVEY_WINDOW_MS;
  const remainingMs = Math.max(0, expiresAt - Date.now());
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}
