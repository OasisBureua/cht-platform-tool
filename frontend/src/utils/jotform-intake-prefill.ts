/**
 * Intake form open/embed URL: optional thank-you redirect + attribution for server webhooks.
 * Jotform should include hidden fields `user_id` and `program_id`; prefill via query works for many setups.
 */
export function buildIntakeFormUrl(
  formUrl: string,
  opts: { returnRedirect?: string; userId?: string; programId?: string },
): string {
  const raw = formUrl.trim();
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (opts.returnRedirect) u.searchParams.set('redirect', opts.returnRedirect);
    if (opts.userId) u.searchParams.set('user_id', opts.userId);
    if (opts.programId) u.searchParams.set('program_id', opts.programId);
    return u.toString();
  } catch {
    const sep = raw.includes('?') ? '&' : '?';
    const parts: string[] = [];
    if (opts.returnRedirect) parts.push(`redirect=${encodeURIComponent(opts.returnRedirect)}`);
    if (opts.userId) parts.push(`user_id=${encodeURIComponent(opts.userId)}`);
    if (opts.programId) parts.push(`program_id=${encodeURIComponent(opts.programId)}`);
    if (parts.length === 0) return raw;
    return `${raw}${sep}${parts.join('&')}`;
  }
}
