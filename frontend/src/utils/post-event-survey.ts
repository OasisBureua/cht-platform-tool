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
