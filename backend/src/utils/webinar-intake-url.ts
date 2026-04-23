/**
 * Effective Jotform intake URL for registration + webhooks.
 * WEBINAR: per-program URL, else optional env default.
 * MEETING (office hours): per-program URL only when set (no shared default).
 */
export function effectiveWebinarIntakeFormUrl(
  zoomSessionType: string,
  jotformIntakeFormUrl: string | null | undefined,
  webinarDefaultIntakeUrl: string | null | undefined,
): string | undefined {
  if (zoomSessionType === 'MEETING') {
    return jotformIntakeFormUrl?.trim() || undefined;
  }
  if (zoomSessionType !== 'WEBINAR') {
    return jotformIntakeFormUrl?.trim() || undefined;
  }
  if (jotformIntakeFormUrl?.trim()) return jotformIntakeFormUrl.trim();
  return webinarDefaultIntakeUrl?.trim() || undefined;
}
