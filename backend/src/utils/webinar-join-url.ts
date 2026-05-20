/**
 * Zoom webinar join URLs:
 * - `zoomJoinUrl` on Program = attendee / "silent participant" link (view-only listeners)
 * - Panelist links in `zoomPanelistLinks` = speakers/host only (share via admin hub)
 * - `zoomStartUrl` = host start link (admins only)
 *
 * Registered learners must always receive the attendee link in-app and in email.
 */

export type ZoomPanelistLinkRow = {
  name?: string;
  email?: string;
  joinUrl?: string;
};

/** Normalize stored attendee join URL; null when unset. */
export function attendeeJoinUrl(
  zoomJoinUrl: string | null | undefined,
): string | null {
  const trimmed = zoomJoinUrl?.trim();
  return trimmed || null;
}

/**
 * Join URL for a registered learner. Always the shared attendee link — never a panelist URL.
 */
export function learnerWebinarJoinUrl(
  zoomJoinUrl: string | null | undefined,
): string | null {
  return attendeeJoinUrl(zoomJoinUrl);
}

/**
 * Panelist link only when the user's email exactly matches a stored panelist entry.
 * Used for admin/speaker tooling — not for typical HCP registrations.
 */
export function panelistJoinUrlForEmail(
  panelistLinks: unknown,
  userEmail: string | null | undefined,
): string | null {
  if (!userEmail?.trim() || !Array.isArray(panelistLinks)) return null;
  const emailNorm = userEmail.trim().toLowerCase();
  for (const row of panelistLinks as ZoomPanelistLinkRow[]) {
    const rowEmail = row.email?.trim().toLowerCase();
    const url = row.joinUrl?.trim();
    if (rowEmail && url && rowEmail === emailNorm) return url;
  }
  return null;
}
