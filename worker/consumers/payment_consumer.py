import os
import boto3
from typing import Optional, Tuple

from sqlalchemy import text
from utils.logger import setup_logger
from utils.sqs_base import SQSBaseConsumer
from services.database import get_db_session

logger = setup_logger(__name__)


class PaymentConsumer(SQSBaseConsumer):
    """Process payment messages from SQS. Records as PENDING for admin review; does not create Bill.com payments."""

    def __init__(self):
        queue_url = os.getenv("SQS_PAYMENT_QUEUE_URL")

        sqs = None
        if queue_url:
            sqs = boto3.client("sqs", region_name=os.getenv("AWS_REGION", "us-east-1"))
            logger.info(f"Payment consumer queue: {queue_url}")

        super().__init__(
            queue_url=queue_url,
            sqs_client=sqs,
            queue_name="payment",
            visibility_timeout=60,
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

    def process_message(self, body: dict) -> bool:
        """Process payment message. Returns True on success."""
        valid, err = self._validate_message(body)
        if not valid:
            logger.error(f"Invalid message: {err}")
            return False

        user_id = body["userId"]
        amount = int(body["amount"])
        payment_type = body["paymentType"]
        program_id = body.get("programId")

        return self._record_pending_payment(user_id, amount, payment_type, program_id)

    def _record_pending_payment(
        self,
        user_id: str,
        amount: int,
        payment_type: str,
        program_id: Optional[str] = None,
    ) -> bool:
        """Record payment as PENDING for admin review. Does not create Bill.com payments or increment earnings."""
        logger.info(f"Recording pending payment: ${amount/100:.2f} for user {user_id} type={payment_type}")

        try:
            with get_db_session() as session:
                result = session.execute(
                    text('SELECT id FROM "User" WHERE id = :user_id'),
                    {"user_id": user_id},
                ).fetchone()

                if not result:
                    logger.error(f"User not found: {user_id}")
                    return False

                session.execute(
                    text("""
                        INSERT INTO "Payment"
                        (id, "userId", "programId", amount, type, status, description, "createdAt", "updatedAt")
                        VALUES
                        (gen_random_uuid()::text, :user_id, :program_id, :amount, :ptype, 'PENDING', :desc, NOW(), NOW())
                    """),
                    {
                        "user_id": user_id,
                        "program_id": program_id,
                        "amount": amount,
                        "ptype": payment_type,
                        "desc": f"Pending admin review - {payment_type}",
                    },
                )

            logger.info(f"Pending payment recorded for user {user_id}: ${amount/100:.2f} (awaiting admin)")
            return True

        except Exception as e:
            logger.error(f"Failed to record pending payment: {e}", exc_info=True)
            return False

    def poll_queue(self):
        """Alias for poll() for backward compatibility."""
        self.poll()


def run():
    consumer = PaymentConsumer()
    consumer.poll_queue()


if __name__ == "__main__":
    run()
