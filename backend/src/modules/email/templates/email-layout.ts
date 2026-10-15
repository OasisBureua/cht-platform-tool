/**
 * Shared HTML email layout: Community Health Media brand (brand guide v2, the
 * same tokens as the site).
 *
 * All transactional emails use `emailWrap()` for one shell:
 *   - optional photo hero (event emails) across the top of the card
 *   - CHM lockup with the signature pixel cluster, then the email's label
 *   - white card body on the brand's cool grey ground
 *   - signature-blue buttons with ink labels; soft grey info panels
 *   - one muted footer line under the card
 *
 * Images load from the public app (`/email/*` in the frontend), set once by
 * the email service through `setEmailAssetBase()`.
 */

// ── Brand palette ──────────────────────────────────────────────────────────────
export const E = {
  HEADER_BG: '#144C60', // deep expertise
  HEADER_SUB: '#F5A524', // amber
  ACCENT: '#2FA9CC', // knowledge blue (buttons; labels sit on it in ink)
  ACCENT_DARK: '#144C60', // deep expertise
  CARD_BG: '#F2F4F8', // base
  BODY_TEXT: '#22303C', // ink
  MUTED: '#3A4A58',
  LABEL: '#5B6B7A',
  FOOTER_BG: '#F2F4F8',
  BORDER: '#E3E7EE',
  LINK: '#144C60',
  WARN_BG: '#FEF6E7',
  WARN_BORDER: '#F5D08A',
  WARN_TEXT: '#6B4A0B',
  SUCCESS_BG: '#F0FDF4',
  SUCCESS_BORDER: '#BBF7D0',
  SUCCESS_TEXT: '#14532D',
} as const;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

let ASSET_BASE = 'https://app.communityhealth.media';
/** Where `/email/*` images are served from (the public app URL). */
export function setEmailAssetBase(url: string): void {
  if (url) ASSET_BASE = url.replace(/\/$/, '');
}
const asset = (name: string) => `${ASSET_BASE}/email/${name}`;

// ── Full wrapper ───────────────────────────────────────────────────────────────
/**
 * Wraps `body` HTML in the standard CHM email chrome.
 *
 * @param sponsorName  Kept for callers; the lockup carries the name.
 * @param subtitle     The email's label above the body (e.g. "Session Reminder").
 * @param body         Inner HTML to render under the label.
 * @param footerNote   Optional extra line in the footer (e.g. timezone notice).
 * @param hero         Show the event photo across the top (invites, reminders).
 */
export function emailWrap(opts: {
  sponsorName: string;
  subtitle: string;
  body: string;
  footerNote?: string;
  hero?: boolean;
}): string {
  const { subtitle, body, footerNote, hero } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:${E.CARD_BG};font-family:${FONT};-webkit-font-smoothing:antialiased">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${E.CARD_BG}">
  <tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0"
           style="background:#ffffff;border:1px solid ${E.BORDER};border-radius:16px;overflow:hidden;max-width:600px;width:100%">
${
  hero
    ? `
      <!-- Hero -->
      <tr><td style="padding:0;line-height:0"><img src="${asset('hero.jpg')}" width="600" alt="An audience at a Community Health Media live session" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:16px 16px 0 0"></td></tr>`
    : ''
}
      <!-- Lockup and pixel cluster -->
      <tr><td style="padding:0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" style="padding:32px 0 0 40px"><img src="${asset('chm-lockup.png')}" width="104" height="27" alt="Community Health Media" style="display:block;border:0"></td>
          <td valign="top" align="right" width="168" style="padding:0;line-height:0"><img src="${asset('cluster.png')}" width="168" height="88" alt="" style="display:block;border:0"></td>
        </tr></table>
      </td></tr>

      <!-- Label and body -->
      <tr><td style="padding:0 40px 32px">
        <p style="margin:0 0 10px;color:${E.LINK};font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase">${subtitle}</p>
        ${body}
      </td></tr>
    </table>

    <!-- Footer -->
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
      <tr><td style="padding:20px 8px 0;color:${E.LABEL};font-size:12px;line-height:1.6;text-align:center">
        Community Health Media &middot; You&rsquo;re receiving this because you have an account on the platform.
        ${footerNote ? `<br>${footerNote}` : ''}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Reusable blocks ────────────────────────────────────────────────────────────

/** Signature-blue CTA button with an ink label. */
export function emailButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:14px 22px;background:${E.ACCENT};color:${E.BODY_TEXT};text-decoration:none;font-weight:700;font-size:15px;border-radius:10px;line-height:1">${label}</a>`;
}

/** Secondary (deep) button: used for neutral actions like "Open in app". */
export function emailButtonDark(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:14px 22px;background:${E.ACCENT_DARK};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;border-radius:10px;line-height:1">${label}</a>`;
}

/** Soft grey info panel (session details, next steps). */
export function emailInfoCard(innerHtml: string): string {
  return `<div style="background:${E.CARD_BG};border-radius:12px;padding:18px 20px;margin:20px 0 0">${innerHtml}</div>`;
}

/** Amber warning card (used for rejection notes, incomplete intake, etc.). */
export function emailWarnCard(innerHtml: string): string {
  return `<div style="background:${E.WARN_BG};border:1px solid ${E.WARN_BORDER};border-radius:10px;padding:14px 18px;margin:20px 0 0">${innerHtml}</div>`;
}

/** Green honorarium / success callout card. */
export function emailSuccessCard(innerHtml: string): string {
  return `<div style="background:${E.SUCCESS_BG};border:1px solid ${E.SUCCESS_BORDER};border-radius:10px;padding:14px 18px;margin:20px 0 0">${innerHtml}</div>`;
}

/** Inline link in deep blue. */
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
