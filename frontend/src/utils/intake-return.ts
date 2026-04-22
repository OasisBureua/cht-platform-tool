/** Jotform thank-you / redirect URLs often pass one of these query keys with the submission id. */
export function readIntakeSubmissionIdFromSearch(search: string): string | undefined {
  const q = new URLSearchParams(search);
  for (const key of ['submission_id', 'submissionId', 'submissionID', 'jid']) {
    const v = q.get(key)?.trim();
    if (v) return v;
  }
  return undefined;
}

/**
 * Build `/app/.../:id/register` for the current area so Jotform can redirect back to the wizard
 * (not the session detail page, which does not read submission ids).
 */
export function buildProgramRegisterHref(programId: string, pathname: string): string {
  if (pathname.includes('/chm-office-hours/')) {
    return `/app/chm-office-hours/${programId}/register`;
  }
  if (pathname.includes('/office-hours/')) {
    return `/app/office-hours/${programId}/register`;
  }
  if (pathname.includes('/webinars/')) {
    return `/app/webinars/${programId}/register`;
  }
  return `/app/live/${programId}/register`;
}
