/**
 * Intake form open/embed URL: prefill `user_id` / `program_id` for webhooks; optional Save & Continue `session`.
 *
 * The `redirect` query on the form URL is not a substitute for Form Settings → Thank You → “Redirect to external link”.
 * The thank-you URL there must include the submission id, e.g. `buildJotformThankYouRedirectTemplate(registerPageUrl)`.
 */
export function buildIntakeFormUrl(
  formUrl: string,
  opts: { returnRedirect?: string; userId?: string; programId?: string; jotformSessionId?: string },
): string {
  const raw = formUrl.trim();
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (opts.returnRedirect) u.searchParams.set('redirect', opts.returnRedirect);
    if (opts.userId) u.searchParams.set('user_id', opts.userId);
    if (opts.programId) u.searchParams.set('program_id', opts.programId);
    if (opts.jotformSessionId?.trim()) u.searchParams.set('session', opts.jotformSessionId.trim());
    return u.toString();
  } catch {
    const sep = raw.includes('?') ? '&' : '?';
    const parts: string[] = [];
    if (opts.returnRedirect) parts.push(`redirect=${encodeURIComponent(opts.returnRedirect)}`);
    if (opts.userId) parts.push(`user_id=${encodeURIComponent(opts.userId)}`);
    if (opts.programId) parts.push(`program_id=${encodeURIComponent(opts.programId)}`);
    if (opts.jotformSessionId?.trim()) parts.push(`session=${encodeURIComponent(opts.jotformSessionId.trim())}`);
    if (parts.length === 0) return raw;
    return `${raw}${sep}${parts.join('&')}`;
  }
}

/**
 * Paste into Jotform: Settings → Thank You page → Redirect to an external link after submission.
 * Jotform replaces `{id}` with the numeric submission id. Docs: https://www.jotform.com/help/38-redirecting-users-to-a-different-page/
 */
export function buildJotformThankYouRedirectTemplate(absoluteRegisterUrl: string): string {
  const base = absoluteRegisterUrl.split('#')[0].trim();
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}submission_id={id}`;
}
