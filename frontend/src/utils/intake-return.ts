/**
 * Jotform thank-you redirect should use e.g. `...?submission_id={id}` ({id} is replaced by Jotform).
 * We accept common query keys and regex-match similar names.
 */
export function readIntakeSubmissionIdFromSearch(search: string): string | undefined {
  const q = new URLSearchParams(search);
  const keys = ['submission_id', 'submissionId', 'submissionID', 'jid', 'sid', 'submission'];
  for (const key of keys) {
    const v = q.get(key)?.trim();
    if (v) return v;
  }
  for (const [k, v] of q.entries()) {
    if (/^submission[_-]?id$/i.test(k) && v?.trim()) return v.trim();
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
