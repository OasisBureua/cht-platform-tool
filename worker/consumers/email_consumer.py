import os
import boto3
from typing import Optional

from utils.logger import setup_logger
from utils.sqs_base import SQSBaseConsumer
from services.email_service import EmailService

logger = setup_logger(__name__)


class EmailConsumer(SQSBaseConsumer):
    """Process email messages from SQS. Failed messages retry; malformed JSON is deleted."""

    def __init__(self):
        queue_url = os.getenv("SQS_EMAIL_QUEUE_URL")
        self.email_service = EmailService()

        sqs = None
        if queue_url:
            sqs = boto3.client("sqs", region_name=os.getenv("AWS_REGION", "us-east-1"))
            logger.info(f"Email consumer queue: {queue_url}")

        super().__init__(
            queue_url=queue_url,
            sqs_client=sqs,
            queue_name="email",
            visibility_timeout=300,  # 5 min
        )

    def _validate_message(self, body: dict) -> tuple:
        """Validate required fields. Returns (valid, error_message)."""
        if body.get("type") != "SEND_EMAIL":
            return False, f"Unknown type: {body.get('type')}"
        if not body.get("to"):
            return False, "Missing 'to'"
        if not body.get("subject"):
            return False, "Missing 'subject'"
        if not body.get("body"):
            return False, "Missing 'body'"
        return True, None

    def process_message(self, body: dict) -> bool:
        """Process email message. Returns True on success."""
        valid, err = self._validate_message(body)
        if not valid:
            logger.error(f"Invalid message: {err}")
            return False

        success = self.email_service.send_email(
            body["to"],
            body["subject"],
            body["body"],
        )
        if success:
            logger.info(f"Email sent to {body['to']}")
        return success

    def poll_queue(self):
        """Alias for poll() for backward compatibility."""
        self.poll()


def run():
    consumer = EmailConsumer()
    consumer.poll_queue()


if __name__ == "__main__":
    run()
