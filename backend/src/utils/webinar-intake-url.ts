/**
 * Published webinar intake: per-program Jotform URL in DB, else optional platform default (ECS env).
 */
export function effectiveWebinarIntakeFormUrl(
  zoomSessionType: string,
  jotformIntakeFormUrl: string | null | undefined,
  webinarDefaultIntakeUrl: string | null | undefined,
): string | undefined {
  if (zoomSessionType !== 'WEBINAR') {
    return jotformIntakeFormUrl?.trim() || undefined;
  }
  if (jotformIntakeFormUrl?.trim()) return jotformIntakeFormUrl.trim();
  return webinarDefaultIntakeUrl?.trim() || undefined;
}
