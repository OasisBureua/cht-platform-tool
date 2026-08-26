import { extractJotformFormIdFromUrl } from './jotform-form-id';

/**
 * Link for admins to open a specific intake submission in Jotform (inbox search).
 * Pattern matches common Jotform inbox query params; adjust if your tenant uses a different URL shape.
 */
export function buildJotformIntakeSubmissionViewUrl(
  intakeFormUrl: string | null | undefined,
  submissionId: string | null | undefined,
): string | null {
  if (!intakeFormUrl?.trim() || !submissionId?.trim()) return null;
  const formId = extractJotformFormIdFromUrl(intakeFormUrl);
  if (!formId) return null;
  try {
    const raw = intakeFormUrl.trim();
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return `${u.origin}/inbox/${formId}?submissionID=${encodeURIComponent(submissionId.trim())}`;
  } catch {
    return null;
  }
}
