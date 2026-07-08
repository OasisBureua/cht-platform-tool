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
export function isPostEventSurveyUnlocked(program: {
  zoomSessionType?: 'WEBINAR' | 'MEETING';
  startDate?: string;
  duration?: number;
  zoomSessionEndedAt?: string;
}): boolean {
  const now = Date.now();
  if (program.zoomSessionEndedAt?.trim()) {
    const t = new Date(program.zoomSessionEndedAt).getTime();
    return !Number.isNaN(t) && now >= t;
  }
  if (program.zoomSessionType === 'MEETING') {
    return true;
  }
  if (!program.startDate?.trim()) {
    return false;
  }
  const start = new Date(program.startDate).getTime();
  if (Number.isNaN(start)) {
    return false;
  }
  const durMin = program.duration ?? 60;
  return now >= start + durMin * 60 * 1000;
}
