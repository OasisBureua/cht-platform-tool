/**
 * Shared HTML email layout helpers — Community Health Media brand (orange palette).
 *
 * All transactional emails use `emailWrap()` to produce a consistent shell:
 *   - Deep-orange header bar  (#7c2d12 brand-800)
 *   - White card body
 *   - Orange CTA buttons      (#ea580c brand-500)
 *   - Orange-accented info cards (#fff7ed bg / #ea580c left border)
 *   - Gray footer strip
 *
 * Colors align with tailwind.config.js `brand.*` palette (orange).
 */

// ── Brand palette ──────────────────────────────────────────────────────────────
export const E = {
  HEADER_BG:   '#7c2d12', // brand-800
  HEADER_SUB:  '#fdba74', // brand-300
  ACCENT:      '#ea580c', // brand-500
  ACCENT_DARK: '#c2410c', // brand-600
  CARD_BG:     '#fff7ed', // brand-50
  BODY_TEXT:   '#111827', // gray-900
  MUTED:       '#4b5563', // gray-600
  LABEL:       '#6b7280', // gray-500
  FOOTER_BG:   '#f9fafb', // gray-50
  BORDER:      '#e5e7eb', // gray-200
  LINK:        '#c2410c', // brand-600
  WARN_BG:     '#fef9c3', // yellow-100
  WARN_BORDER: '#fde047', // yellow-300
  WARN_TEXT:   '#713f12', // yellow-900
  SUCCESS_BG:  '#f0fdf4', // green-50
  SUCCESS_BORDER: '#bbf7d0', // green-200
  SUCCESS_TEXT:   '#14532d', // green-900
} as const;

// ── Full wrapper ───────────────────────────────────────────────────────────────
/**
 * Wraps `body` HTML in the standard CHM email chrome: outer bg, card, orange
 * header, and footer.
 *
 * @param sponsorName  Displayed in the header (e.g. "Community Health Media").
 * @param subtitle     Short label shown under sponsor name (e.g. "Session Reminder").
 * @param body         Inner HTML to render between header and footer.
 * @param footerNote   Optional extra line in the footer (e.g. timezone notice).
 */
export function emailWrap(opts: {
  sponsorName: string;
  subtitle: string;
  body: string;
  footerNote?: string;
}): string {
  const { sponsorName, subtitle, body, footerNote } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6">
  <tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0"
           style="background:#ffffff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;max-width:600px;width:100%">

      <!-- Header -->
      <tr>
        <td style="background:${E.HEADER_BG};padding:28px 36px 24px">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em">${sponsorName}</p>
          <p style="margin:5px 0 0;color:${E.HEADER_SUB};font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase">${subtitle}</p>
        </td>
      </tr>

      <!-- Body -->
      <tr><td style="padding:32px 36px 24px">${body}</td></tr>

      <!-- Footer -->
      <tr>
        <td style="background:${E.FOOTER_BG};border-top:1px solid ${E.BORDER};padding:16px 36px">
          <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;line-height:1.6">
            &copy; ${sponsorName} &nbsp;&middot;&nbsp; You are receiving this because you have an account on the platform.
            ${footerNote ? `<br>${footerNote}` : ''}
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Reusable blocks ────────────────────────────────────────────────────────────

/** Orange CTA button. */
export function emailButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 24px;background:${E.ACCENT};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;border-radius:8px;letter-spacing:0.01em;line-height:1">${label} &rarr;</a>`;
}

/** Secondary (dark) button — used for neutral actions like "Open in app". */
export function emailButtonDark(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 24px;background:${E.BODY_TEXT};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;border-radius:8px;letter-spacing:0.01em;line-height:1">${label} &rarr;</a>`;
}

/** Orange-accented info card (brand-50 bg + brand-500 left border). */
export function emailInfoCard(innerHtml: string): string {
  return `<div style="background:${E.CARD_BG};border-left:4px solid ${E.ACCENT};border-radius:10px;padding:20px 24px;margin:20px 0 0">${innerHtml}</div>`;
}

/** Amber warning card (used for rejection notes, incomplete intake, etc.). */
export function emailWarnCard(innerHtml: string): string {
  return `<div style="background:${E.WARN_BG};border:1px solid ${E.WARN_BORDER};border-radius:10px;padding:14px 18px;margin:20px 0 0">${innerHtml}</div>`;
}

/** Green honorarium / success callout card. */
export function emailSuccessCard(innerHtml: string): string {
  return `<div style="background:${E.SUCCESS_BG};border:1px solid ${E.SUCCESS_BORDER};border-radius:10px;padding:14px 18px;margin:20px 0 0">${innerHtml}</div>`;
}

/** Inline orange link. */
export function emailLink(href: string, label: string): string {
  return `<a href="${href}" style="color:${E.LINK};text-decoration:underline">${label}</a>`;
}

/** "Questions? Contact us" support line. */
export function emailSupportLine(supportEscaped: string): string {
  return `<p style="margin:24px 0 0;color:${E.LABEL};font-size:13px;line-height:1.6">Questions? Reply to this email or reach us at <a href="mailto:${supportEscaped}" style="color:${E.LINK}">${supportEscaped}</a>.</p>`;
}

/** Small muted URL shown under a button. */
export function emailUrlLine(urlEscaped: string): string {
  return `<p style="margin:10px 0 0;font-size:12px;color:${E.LABEL};word-break:break-all"><a href="${urlEscaped}" style="color:${E.LABEL}">${urlEscaped}</a></p>`;
}
