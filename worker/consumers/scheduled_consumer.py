"""Scheduled-jobs consumer — processes EventBridge trigger payloads from the
SQS scheduled-jobs queue.

Each message has a single field:
  {"type": "SESSION_REMINDERS"}

The consumer runs the appropriate job in-process and then deletes the message.

Design notes
------------
* One message → one full scan (not one message per registrant).  EventBridge
  publishes at most one message per schedule tick, so the visibility-timeout
  heartbeat in SQSBaseConsumer keeps the message invisible while we page through
  every eligible registration.
* Idempotency is provided by the DB column ProgramRegistration.reminder24hSentAt:
  the UPDATE only fires when that column IS NULL, so re-runs (retries / duplicate
  EventBridge fires) are harmless.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import List

import boto3
from botocore.config import Config
from sqlalchemy import text

from services.database import get_db_session
from services.session_reminder_email import build_session_reminder_email
from utils.logger import setup_logger
from utils.sqs_base import PermanentFailure, SQSBaseConsumer

logger = setup_logger(__name__)

# ── Window: sessions starting between NOW+LOW and NOW+HIGH get a reminder ──────
# EventBridge fires every 6 hours; window is [18h, 30h] — centered on 24h with
# a 12h spread so every session is caught by at least one tick regardless of
# when the cron last ran.  Both bounds are env-overridable.
_REMINDER_WINDOW_LOW_H = float(os.getenv("REMINDER_WINDOW_LOW_H", "18"))   # 18h from now
_REMINDER_WINDOW_HIGH_H = float(os.getenv("REMINDER_WINDOW_HIGH_H", "30")) # 30h from now


class ScheduledConsumer(SQSBaseConsumer):
    """Consumer for EventBridge-scheduled job triggers."""

    SESSION_REMINDERS = "SESSION_REMINDERS"

    def __init__(self):
        queue_url = os.getenv("SQS_SCHEDULED_JOBS_QUEUE_URL")

        sqs = None
        if queue_url:
            sqs = boto3.client(
                "sqs",
                region_name=os.getenv("AWS_REGION", "us-east-1"),
                config=Config(retries={"max_attempts": 5, "mode": "adaptive"}),
            )
            logger.info(f"Scheduled consumer queue: {queue_url}")

        super().__init__(
            queue_url=queue_url,
            sqs_client=sqs,
            queue_name="scheduled-jobs",
            visibility_timeout=900,  # 15 min; extended by heartbeat for large cohorts
            max_messages=1,           # One trigger at a time; jobs are long-running
            wait_time_seconds=20,
        )

    # ── SQSBaseConsumer contract ───────────────────────────────────────────────

    def process_message(self, body: dict) -> bool:
        msg_type = body.get("type")
        if msg_type == self.SESSION_REMINDERS:
            return self._session_reminders()
        raise PermanentFailure(f"Unknown scheduled job type: {msg_type!r}")

    # ── Session reminders ──────────────────────────────────────────────────────

    def _session_reminders(self) -> bool:
        """Scan APPROVED registrations for sessions starting in the reminder window
        and send each user one reminder email if it has not already been sent."""
        ses_from = os.getenv("SES_FROM_EMAIL", "")
        if not ses_from:
            logger.warning("SES_FROM_EMAIL not set — skipping session reminders")
            return True  # Not a transient error; nothing to retry

        now = datetime.now(tz=timezone.utc)
        window_low = now + timedelta(hours=_REMINDER_WINDOW_LOW_H)
        window_high = now + timedelta(hours=_REMINDER_WINDOW_HIGH_H)

        logger.info(
            f"[session-reminders] scanning window {window_low.isoformat()} "
            f"→ {window_high.isoformat()}"
        )

        candidates = self._fetch_reminder_candidates(window_low, window_high)
        logger.info(f"[session-reminders] {len(candidates)} candidate(s) found")

        base_url = (os.getenv("FRONTEND_APP_URL", "")).rstrip("/")
        sent = failed = skipped = 0

        for row in candidates:
            try:
                result = self._send_one_reminder(row, base_url, ses_from)
                if result:
                    sent += 1
                else:
                    skipped += 1
            except Exception as exc:
                logger.error(
                    f"[session-reminders] failed for registration "
                    f"{row['registration_id']}: {exc}",
                    exc_info=True,
                )
                failed += 1

        logger.info(
            f"[session-reminders] done — sent={sent} skipped={skipped} failed={failed}"
        )
        # Return True even if some individual emails failed so the trigger message
        # is removed.  Per-registration failures are logged; the next tick will
        # re-scan and pick up anything that is still unsent.
        return True

    def _fetch_reminder_candidates(
        self, low: datetime, high: datetime
    ) -> List[dict]:
        """Return APPROVED registrations whose program starts in [low, high] and
        whose reminder24hSentAt IS NULL."""
        sql = text(
            """
            SELECT
                pr.id                    AS registration_id,
                pr."userId"              AS user_id,
                pr."programId"           AS program_id,
                u.email                  AS user_email,
                u."firstName"            AS first_name,
                p.title                  AS program_title,
                p.description            AS program_description,
                p."startDate"            AS start_date,
                p.duration               AS duration_minutes,
                p."zoomJoinUrl"          AS zoom_join_url,
                p."hostDisplayName"      AS host_display_name,
                p."sponsorName"          AS sponsor_name,
                p."zoomSessionType"      AS zoom_session_type
            FROM "ProgramRegistration" pr
            JOIN "User"    u ON u.id = pr."userId"
            JOIN "Program" p ON p.id = pr."programId"
            WHERE
                pr.status                = 'APPROVED'
                AND pr."reminder24hSentAt" IS NULL
                AND p."startDate"        >= :low
                AND p."startDate"        <  :high
                AND p.status             = 'PUBLISHED'
            ORDER BY p."startDate", pr.id
            """
        )
        with get_db_session() as session:
            rows = session.execute(sql, {"low": low, "high": high}).mappings().all()
            return [dict(r) for r in rows]

    def _send_one_reminder(
        self, row: dict, base_url: str, ses_from: str
    ) -> bool:
        """Build and send a single reminder email, then mark it sent atomically.

        Returns True if sent (or already sent by a concurrent process).
        Returns False to signal a skipped / non-fatal situation.
        """
        registration_id = row["registration_id"]
        program_id = row["program_id"]
        start_dt: datetime = row["start_date"]

        # Ensure start_date is timezone-aware
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)

        hours_until = (start_dt - datetime.now(tz=timezone.utc)).total_seconds() / 3600

        session_kind = row.get("zoom_session_type") or "WEBINAR"
        is_webinar = session_kind == "WEBINAR"
        if is_webinar:
            app_session_url = f"{base_url}/app/live/{program_id}"
        else:
            app_session_url = f"{base_url}/app/chm-office-hours/{program_id}"

        subject, plain, html = build_session_reminder_email(
            first_name=row["first_name"] or "there",
            program_title=row["program_title"],
            program_description=row.get("program_description"),
            start_utc=start_dt,
            duration_minutes=row.get("duration_minutes"),
            zoom_join_url=row.get("zoom_join_url"),
            host_display_name=row.get("host_display_name"),
            sponsor_name=row["sponsor_name"],
            app_session_url=app_session_url,
            support_email=ses_from,
            hours_until_start=hours_until,
            session_kind_webinar=is_webinar,
        )

        # Atomically mark sent before calling SES so a crash between the two
        # steps causes a duplicate email rather than a missed one (the lesser evil).
        # The UPDATE returns 0 rows if already set (concurrent worker) — safe to skip.
        marked = self._mark_reminder_sent(registration_id)
        if not marked:
            logger.info(
                f"[session-reminders] registration {registration_id} already marked — skipping SES call"
            )
            return False

        ses = boto3.client(
            "ses",
            region_name=os.getenv("AWS_REGION", "us-east-1"),
            config=Config(retries={"max_attempts": 5, "mode": "adaptive"}),
        )
        try:
            ses.send_email(
                Source=ses_from,
                Destination={"ToAddresses": [row["user_email"]]},
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {
                        "Text": {"Data": plain, "Charset": "UTF-8"},
                        "Html": {"Data": html, "Charset": "UTF-8"},
                    },
                },
            )
        except Exception as ses_exc:
            # Roll back the mark so the next EventBridge tick will retry.
            self._unmark_reminder_sent(registration_id)
            raise ses_exc

        logger.info(
            f"[session-reminders] sent reminder to {row['user_email']} "
            f"for program {program_id} (registration {registration_id})"
        )
        return True

    def _mark_reminder_sent(self, registration_id: str) -> bool:
        """Set reminder24hSentAt = NOW() only if it is still NULL.

        Returns True if the row was updated (this process owns the send),
        False if another process already set it.
        """
        sql = text(
            """
            UPDATE "ProgramRegistration"
            SET    "reminder24hSentAt" = NOW()
            WHERE  id = :reg_id
              AND  "reminder24hSentAt" IS NULL
            """
        )
        with get_db_session() as session:
            result = session.execute(sql, {"reg_id": registration_id})
            return (result.rowcount or 0) > 0

    def _unmark_reminder_sent(self, registration_id: str) -> None:
        """Reset reminder24hSentAt back to NULL after a failed SES call so the
        next EventBridge tick will re-attempt delivery for this registration."""
        sql = text(
            """
            UPDATE "ProgramRegistration"
            SET    "reminder24hSentAt" = NULL
            WHERE  id = :reg_id
            """
        )
        try:
            with get_db_session() as session:
                session.execute(sql, {"reg_id": registration_id})
            logger.info(
                f"[session-reminders] rolled back reminder mark for registration {registration_id}"
            )
        except Exception as db_exc:
            logger.error(
                f"[session-reminders] could not roll back reminder mark for {registration_id}: {db_exc}",
                exc_info=True,
            )


def run():
    consumer = ScheduledConsumer()
    consumer.poll()


if __name__ == "__main__":
    run()
