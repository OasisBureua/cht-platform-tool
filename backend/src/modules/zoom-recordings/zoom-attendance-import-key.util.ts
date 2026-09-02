import type { ZoomReportParticipant } from '../webinars/zoom.service';

/** Trim Zoom Report API participant id; null when missing or blank (never synthesize an id). */
export function normalizeReportZoomParticipantId(
  id?: string | null,
): string | null {
  const trimmed = id?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeReportParticipantEmail(
  email?: string | null,
): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/**
 * Report rows need a join time plus at least one identity field (Zoom id, email, or name).
 */
export function canImportReportParticipant(
  participant: Pick<ZoomReportParticipant, 'id' | 'joinTime' | 'userEmail' | 'name'>,
): boolean {
  if (!participant.joinTime?.trim()) return false;
  return !!(
    normalizeReportZoomParticipantId(participant.id) ||
    normalizeReportParticipantEmail(participant.userEmail) ||
    participant.name?.trim()
  );
}

export function reportParticipantLabel(
  participant: Pick<ZoomReportParticipant, 'id' | 'userEmail' | 'name'>,
): string {
  return (
    normalizeReportZoomParticipantId(participant.id) ||
    normalizeReportParticipantEmail(participant.userEmail) ||
    participant.name?.trim() ||
    'unknown'
  );
}
