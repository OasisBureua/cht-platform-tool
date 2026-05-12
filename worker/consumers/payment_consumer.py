import os
import boto3
from botocore.config import Config
from typing import Optional, Tuple

from sqlalchemy import text
from utils.logger import setup_logger
from utils.sqs_base import PermanentFailure, SQSBaseConsumer
from services.database import get_db_session

logger = setup_logger(__name__)


class PaymentConsumer(SQSBaseConsumer):
    """Process payment messages from SQS. Records as PENDING for admin review; does not create Bill.com payments."""

    def __init__(self):
        queue_url = os.getenv("SQS_PAYMENT_QUEUE_URL")

        sqs = None
        if queue_url:
            sqs = boto3.client(
                "sqs",
                region_name=os.getenv("AWS_REGION", "us-east-1"),
                config=Config(retries={"max_attempts": 5, "mode": "adaptive"}),
            )
            logger.info(f"Payment consumer queue: {queue_url}")

        super().__init__(
            queue_url=queue_url,
            sqs_client=sqs,
            queue_name="payment",
            visibility_timeout=180,  # 3-min window; heartbeat extends as needed
        )

    def _validate_message(self, body: dict) -> Tuple[bool, Optional[str]]:
        """Validate required fields. Returns (valid, error_message)."""
        if body.get("type") != "PROCESS_PAYMENT":
            return False, f"Unknown type: {body.get('type')}"
        if not body.get("userId"):
            return False, "Missing userId"
        if "amount" not in body or not isinstance(body["amount"], (int, float)):
            return False, "Missing or invalid amount"
        if not body.get("paymentType"):
            return False, "Missing paymentType"
        return True, None

    def _resolve_idempotency_key(self, body: dict, user_id: str, amount: int, payment_type: str, program_id: Optional[str]) -> str:
        """Stable key for ON CONFLICT dedupe (SQS at-least-once, parallel API calls)."""
        key = body.get("idempotencyKey")
        if isinstance(key, str) and key.strip():
            return key.strip()
        if program_id and payment_type == "HONORARIUM":
            return f"honorarium:{user_id}:{program_id}"
        return f"legacy:{user_id}:{payment_type}:{program_id or ''}:{amount}"

    def process_message(self, body: dict) -> bool:
        """Process payment message. Returns True on success."""
        valid, err = self._validate_message(body)
        if not valid:
            # Structural/schema errors never fix themselves — remove from queue immediately
            raise PermanentFailure(f"Invalid message: {err}")

        user_id = body["userId"]
        amount = int(body["amount"])
        payment_type = body["paymentType"]
        program_id = body.get("programId")
        idempotency_key = self._resolve_idempotency_key(body, user_id, amount, payment_type, program_id)

        return self._record_pending_payment(
            user_id, amount, payment_type, program_id, idempotency_key,
        )

    def _record_pending_payment(
        self,
        user_id: str,
        amount: int,
        payment_type: str,
        program_id: Optional[str],
        idempotency_key: str,
    ) -> bool:
        """Record payment as PENDING. Duplicate idempotency_key is ignored (success)."""
        logger.info(
            f"Recording pending payment: ${amount/100:.2f} for user {user_id} type={payment_type} key={idempotency_key!r}",
        )

        try:
            with get_db_session() as session:
                result = session.execute(
                    text('SELECT id FROM "User" WHERE id = :user_id'),
                    {"user_id": user_id},
                ).fetchone()

                if not result:
                    # User doesn't exist — no amount of retries will fix this
                    raise PermanentFailure(f"User not found: {user_id}")

                description = self._pending_payment_description(
                    session, payment_type, program_id,
                )

                row = session.execute(
                    text(
                        """
                        INSERT INTO "Payment"
                        (id, "userId", "programId", amount, type, status, description, "idempotencyKey", "createdAt", "updatedAt")
                        VALUES
                        (gen_random_uuid()::text, :user_id, :program_id, :amount, CAST(:ptype AS "PaymentType"), 'PENDING', :desc, :idempotency_key, NOW(), NOW())
                        ON CONFLICT ("idempotencyKey") DO NOTHING
                        RETURNING id
                        """
                    ),
                    {
                        "user_id": user_id,
                        "program_id": program_id,
                        "amount": amount,
                        "ptype": payment_type,
                        "desc": description,
                        "idempotency_key": idempotency_key,
                    },
                ).fetchone()

                if row:
                    logger.info(
                        f"Pending payment recorded for user {user_id}: ${amount/100:.2f} (awaiting admin)",
                    )
                else:
                    logger.info(
                        f"Skipped insert — duplicate idempotencyKey for user {user_id} type={payment_type}",
                    )

            return True

        except Exception as e:
            logger.error(f"Failed to record pending payment: {e}", exc_info=True)
            return False

    def _pending_payment_description(
        self,
        session,
        payment_type: str,
        program_id: Optional[str],
    ) -> str:
        """Human-readable pending row label for admin payment queues."""
        if payment_type == "HONORARIUM" and program_id:
            prow = session.execute(
                text('SELECT title FROM "Program" WHERE id = :pid'),
                {"pid": program_id},
            ).fetchone()
            if prow and prow[0]:
                title = str(prow[0]).strip()
                # Keep reasonable length for Payment.description
                if len(title) > 180:
                    title = title[:177] + "…"
                return f"HONORARIUM for {title}"
            return "HONORARIUM"
        return f"Pending admin review - {payment_type}"

    def poll_queue(self):
        """Alias for poll() for backward compatibility."""
        self.poll()


def run():
    consumer = PaymentConsumer()
    consumer.poll_queue()


if __name__ == "__main__":
    run()
