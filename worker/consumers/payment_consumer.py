import os
import boto3
import stripe
from typing import Optional, Tuple

from sqlalchemy import text
from utils.logger import setup_logger
from utils.sqs_base import SQSBaseConsumer
from services.database import get_db_session

logger = setup_logger(__name__)


class PaymentConsumer(SQSBaseConsumer):
    """Process payment messages from SQS. Failed messages retry; DLQ handles after max retries."""

    def __init__(self):
        queue_url = os.getenv("SQS_PAYMENT_QUEUE_URL")
        stripe_key = os.getenv("STRIPE_SECRET_KEY")

        if stripe_key:
            stripe.api_key = stripe_key
            logger.info("Stripe initialized")
        else:
            logger.warning("Stripe not configured - running in mock mode")

        sqs = None
        if queue_url:
            sqs = boto3.client("sqs", region_name=os.getenv("AWS_REGION", "us-east-1"))
            logger.info(f"Payment consumer queue: {queue_url}")

        super().__init__(
            queue_url=queue_url,
            sqs_client=sqs,
            queue_name="payment",
            visibility_timeout=600,  # 10 min for Stripe/payment ops
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
            return False  # Will retry - consider logging and returning True to drop bad messages

        user_id = body["userId"]
        amount = int(body["amount"])
        payment_type = body["paymentType"]
        program_id = body.get("programId")

        return self._process_payment(user_id, amount, payment_type, program_id)

    def _process_payment(
        self,
        user_id: str,
        amount: int,
        payment_type: str,
        program_id: Optional[str] = None,
    ) -> bool:
        """Process payment via Stripe or mock."""
        logger.info(f"Processing payment: ${amount/100:.2f} for user {user_id} type={payment_type}")

        try:
            with get_db_session() as session:
                result = session.execute(
                    text('SELECT "stripeAccountId", email FROM "User" WHERE id = :user_id'),
                    {"user_id": user_id},
                ).fetchone()

                if not result:
                    logger.error(f"User not found: {user_id}")
                    return False

                stripe_account_id = result[0]
                email = result[1]

                if not stripe_account_id:
                    logger.warning(f"User {email} has no Stripe account - skipping")
                    return True  # Don't retry - user needs to onboard

            if not stripe.api_key:
                return self._process_payment_mock(user_id, amount, payment_type, program_id)

            transfer = stripe.Transfer.create(
                amount=amount,
                currency="usd",
                destination=stripe_account_id,
                description=f"{payment_type} payment",
            )
            logger.info(f"Stripe transfer created: {transfer.id}")

            with get_db_session() as session:
                session.execute(
                    text("""
                        INSERT INTO "Payment"
                        (id, "userId", "programId", amount, type, status, "stripeTransferId", "createdAt", "updatedAt", "paidAt")
                        VALUES
                        (gen_random_uuid()::text, :user_id, :program_id, :amount, :ptype, 'PAID', :transfer_id, NOW(), NOW(), NOW())
                    """),
                    {
                        "user_id": user_id,
                        "program_id": program_id,
                        "amount": amount,
                        "ptype": payment_type,
                        "transfer_id": transfer.id,
                    },
                )
                session.execute(
                    text('UPDATE "User" SET "totalEarnings" = "totalEarnings" + :amount WHERE id = :user_id'),
                    {"amount": amount, "user_id": user_id},
                )

            logger.info(f"Payment recorded for user {user_id}: ${amount/100:.2f}")
            return True

        except stripe.StripeError as e:
            logger.error(f"Stripe error: {e}")
            return False  # Retry - transient Stripe errors
        except Exception as e:
            logger.error(f"Payment failed: {e}", exc_info=True)
            return False

    def _process_payment_mock(
        self,
        user_id: str,
        amount: int,
        payment_type: str,
        program_id: Optional[str],
    ) -> bool:
        """Mock payment - record in DB without Stripe."""
        try:
            with get_db_session() as session:
                result = session.execute(
                    text('SELECT "stripeAccountId" FROM "User" WHERE id = :user_id'),
                    {"user_id": user_id},
                ).fetchone()
                stripe_account_id = result[0] if result else "mock-account"

            logger.info(f"[PAYMENT MOCK] Transfer ${amount/100:.2f} to {stripe_account_id}")

            with get_db_session() as session:
                session.execute(
                    text("""
                        INSERT INTO "Payment"
                        (id, "userId", "programId", amount, type, status, description, "createdAt", "updatedAt", "paidAt")
                        VALUES
                        (gen_random_uuid()::text, :user_id, :program_id, :amount, :ptype, 'PAID', :desc, NOW(), NOW(), NOW())
                    """),
                    {
                        "user_id": user_id,
                        "program_id": program_id,
                        "amount": amount,
                        "ptype": payment_type,
                        "desc": f"{payment_type} payment (mock)",
                    },
                )
                session.execute(
                    text('UPDATE "User" SET "totalEarnings" = "totalEarnings" + :amount WHERE id = :user_id'),
                    {"amount": amount, "user_id": user_id},
                )

            logger.info(f"Mock payment recorded for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Mock payment failed: {e}", exc_info=True)
            return False

    def poll_queue(self):
        """Alias for poll() for backward compatibility."""
        self.poll()


def run():
    consumer = PaymentConsumer()
    consumer.poll_queue()


if __name__ == "__main__":
    run()
