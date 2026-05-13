"""Build subject, plain-text, and HTML bodies for the 24h pre-session reminder email.

Colors match the Community Health Media brand palette (tailwind.config.js brand.*).
Times are displayed in America/New_York (ET — auto-switches EST/EDT).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Tuple

try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except ImportError:  # pragma: no cover
    from backports.zoneinfo import ZoneInfo  # type: ignore

# ── Brand colours (CHM orange palette) ────────────────────────────────────────
CLR_HEADER_BG   = "#7c2d12"   # brand-800  — deep orange header
CLR_HEADER_SUB  = "#fdba74"   # brand-300  — light orange subtitle
CLR_ACCENT      = "#ea580c"   # brand-500  — main orange
CLR_ACCENT_DARK = "#c2410c"   # brand-600  — button hover / border
CLR_CARD_BG     = "#fff7ed"   # brand-50   — session card background
CLR_CARD_BORDER = "#ea580c"   # brand-500  — card left border
CLR_BODY_TEXT   = "#111827"   # gray-900   — primary text
CLR_MUTED       = "#4b5563"   # gray-600   — muted text
CLR_LABEL       = "#6b7280"   # gray-500   — table label column
CLR_FOOTER_BG   = "#f9fafb"   # gray-50    — footer strip
CLR_BORDER      = "#e5e7eb"   # gray-200   — dividers
CLR_LINK        = "#c2410c"   # brand-600  — inline links

_ET = ZoneInfo("America/New_York")


def _fmt_time_et(dt: datetime) -> str:
    """Return a human-readable Eastern time string.
    e.g. 'Thursday, May 15 at 2:00 PM EDT'
    """
    et = dt.astimezone(_ET)
    # %Z gives 'EDT' or 'EST' automatically
    return et.strftime("%-I:%M %p %Z on %A, %B %-d, %Y")


def _fmt_duration(minutes: Optional[int]) -> str:
    if not minutes:
        return ""
    if minutes < 60:
        return f"{minutes} minutes"
    hours = minutes // 60
    mins = minutes % 60
    if mins:
        return f"{hours}h {mins}m"
    return f"{hours} hour{'s' if hours > 1 else ''}"


def build_session_reminder_email(
    *,
    first_name: str,
    program_title: str,
    program_description: Optional[str],
    start_utc: datetime,
    duration_minutes: Optional[int],
    zoom_join_url: Optional[str],
    host_display_name: Optional[str],
    sponsor_name: str,
    app_session_url: str,
    support_email: str,
    hours_until_start: float,
    session_kind_webinar: bool,
) -> Tuple[str, str, str]:
    """Return (subject, plain_text, html).

    Args:
        first_name: Recipient first name.
        program_title: Title of the session / program.
        program_description: Optional short description.
        start_utc: Session start time (timezone-aware UTC).
        duration_minutes: Session duration; None if unknown.
        zoom_join_url: Direct Zoom join link; None if not yet set.
        host_display_name: e.g. "Dr. Jane Smith"; None to omit.
        sponsor_name: Sponsoring organisation name.
        app_session_url: Full URL to the session detail page.
        support_email: Reply-to / help email address.
        hours_until_start: Fractional hours until session starts.
        session_kind_webinar: True → "webinar", False → "office hours".
    """
    kind = "webinar" if session_kind_webinar else "office hours"
    hours_label = f"~{int(round(hours_until_start))} hours"
    start_str = _fmt_time_et(start_utc)
    duration_str = _fmt_duration(duration_minutes)

    # ── Subject ────────────────────────────────────────────────────────────────
    subject = f"Reminder: Your {kind} starts in {hours_label} — {program_title}"

    # ── Plain text ─────────────────────────────────────────────────────────────
    host_line     = f"Host:     {host_display_name}\n" if host_display_name else ""
    duration_line = f"Duration: {duration_str}\n" if duration_str else ""
    join_line     = f"Join:     {zoom_join_url}\n" if zoom_join_url else ""
    desc_block    = f"\n{program_description.strip()}\n" if program_description else ""

    plain = f"""Hi {first_name},

This is a friendly reminder that your upcoming {kind} starts in {hours_label}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {program_title}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  When:     {start_str}
  {host_line}{duration_line}{join_line}
{desc_block}
View session details and your join link:
  {app_session_url}

Questions? Reply to this email or reach us at {support_email}.

See you there,
The {sponsor_name} Team
""".strip()

    # ── HTML ───────────────────────────────────────────────────────────────────

    host_row = (
        f"<tr>"
        f"<td style='padding:6px 12px 6px 0;color:{CLR_LABEL};font-size:13px;white-space:nowrap;vertical-align:top'>Host</td>"
        f"<td style='padding:6px 0;color:{CLR_BODY_TEXT};font-size:14px;font-weight:600'>{host_display_name}</td>"
        f"</tr>"
    ) if host_display_name else ""

    duration_row = (
        f"<tr>"
        f"<td style='padding:6px 12px 6px 0;color:{CLR_LABEL};font-size:13px;white-space:nowrap;vertical-align:top'>Duration</td>"
        f"<td style='padding:6px 0;color:{CLR_BODY_TEXT};font-size:14px'>{duration_str}</td>"
        f"</tr>"
    ) if duration_str else ""

    join_button = (
        f"<a href='{zoom_join_url}' style='"
        f"display:inline-block;margin-top:20px;padding:12px 28px;"
        f"background:{CLR_ACCENT};color:#ffffff;text-decoration:none;"
        f"border-radius:8px;font-weight:700;font-size:15px;"
        f"letter-spacing:0.01em;line-height:1'>"
        f"Join Zoom Session &rarr;"
        f"</a>"
    ) if zoom_join_url else ""

    desc_block_html = (
        f"<p style='margin:16px 0 0;color:{CLR_MUTED};font-size:13px;line-height:1.6;border-top:1px solid {CLR_BORDER};padding-top:14px'>"
        f"{program_description.strip()}"
        f"</p>"
    ) if program_description else ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6">
    <tr><td align="center" style="padding:40px 16px">

      <!-- Card -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;max-width:600px;width:100%">

        <!-- ── Header ─────────────────────────────────────────────────────── -->
        <tr>
          <td style="background:{CLR_HEADER_BG};padding:32px 40px 28px">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td>
                  <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em">{sponsor_name}</p>
                  <p style="margin:6px 0 0;color:{CLR_HEADER_SUB};font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Session Reminder</p>
                </td>
                <td align="right" style="vertical-align:middle">
                  <!-- orange clock icon circle -->
                  <div style="width:44px;height:44px;background:rgba(255,255,255,0.12);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:22px;line-height:44px;text-align:center">&#128337;</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Body ───────────────────────────────────────────────────────── -->
        <tr>
          <td style="padding:36px 40px 0">

            <p style="margin:0 0 6px;color:{CLR_BODY_TEXT};font-size:17px">
              Hi <strong>{first_name}</strong>,
            </p>
            <p style="margin:0 0 28px;color:{CLR_MUTED};font-size:15px;line-height:1.6">
              Your upcoming <strong style="color:{CLR_BODY_TEXT}">{kind}</strong> is starting in
              <strong style="color:{CLR_ACCENT_DARK}">{hours_label}</strong>. Here are the details:
            </p>

            <!-- Session card -->
            <div style="background:{CLR_CARD_BG};border-left:4px solid {CLR_CARD_BORDER};border-radius:10px;padding:24px 28px">

              <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:{CLR_HEADER_BG};line-height:1.3">{program_title}</p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
                <tr>
                  <td style="padding:6px 12px 6px 0;color:{CLR_LABEL};font-size:13px;white-space:nowrap;vertical-align:top">Date &amp; Time</td>
                  <td style="padding:6px 0;color:{CLR_BODY_TEXT};font-size:14px;font-weight:600">{start_str}</td>
                </tr>
                {host_row}
                {duration_row}
              </table>

              {desc_block_html}
              {join_button}
            </div>

          </td>
        </tr>

        <!-- ── View details CTA ───────────────────────────────────────────── -->
        <tr>
          <td style="padding:28px 40px 0">
            <p style="margin:0 0 8px;color:{CLR_MUTED};font-size:13px">
              View your full session details and join link at any time:
            </p>
            <p style="margin:0">
              <a href="{app_session_url}"
                 style="color:{CLR_LINK};font-size:13px;word-break:break-all;text-decoration:underline">{app_session_url}</a>
            </p>
          </td>
        </tr>

        <!-- ── Support ────────────────────────────────────────────────────── -->
        <tr>
          <td style="padding:24px 40px 32px">
            <p style="margin:0;color:{CLR_LABEL};font-size:13px;line-height:1.6">
              Questions? Reply to this email or reach us at
              <a href="mailto:{support_email}" style="color:{CLR_LINK}">{support_email}</a>.
            </p>
          </td>
        </tr>

        <!-- ── Footer ─────────────────────────────────────────────────────── -->
        <tr>
          <td style="background:{CLR_FOOTER_BG};border-top:1px solid {CLR_BORDER};padding:18px 40px">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.5">
              &copy; {sponsor_name} &nbsp;&middot;&nbsp;
              You are receiving this because you registered for this session.<br>
              Times shown in Eastern Time (ET).
            </p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>

</body>
</html>"""

    return subject, plain, html
