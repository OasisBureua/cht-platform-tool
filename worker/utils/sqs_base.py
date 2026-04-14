"""
Base SQS consumer with retry handling, structured logging, and DLQ support.

When processing fails, the message is NOT deleted - it becomes visible again after
VisibilityTimeout. Configure the main queue's redrive policy to send to DLQ after
maxReceiveCount (e.g. 5) receives.
"""
import json
import time
import traceback
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

from utils.logger import setup_logger

logger = setup_logger(__name__)


class SQSBaseConsumer(ABC):
    """
    Base class for SQS consumers with:
    - Retry on failure (don't delete, message becomes visible again)
    - Structured logging with message_id, receive_count
    - Full traceback on errors
    - Graceful handling of malformed messages
    """

    def __init__(
        self,
        queue_url: Optional[str],
        sqs_client: Optional[Any],
        queue_name: str = "queue",
        visibility_timeout: int = 300,
        max_messages: int = 10,
        wait_time_seconds: int = 20,
    ):
        self.queue_url = queue_url
        self.sqs = sqs_client
        self.queue_name = queue_name
        self.visibility_timeout = visibility_timeout
        self.max_messages = max_messages
        self.wait_time_seconds = wait_time_seconds
        self._shutdown = False

    def _log_message_event(self, event: str, message: Dict[str, Any], success: Optional[bool] = None):
        """Structured log for message events."""
        attrs = message.get("Attributes", {})
        receive_count = int(attrs.get("ApproximateReceiveCount", 1))
        msg_id = message.get("MessageId", "unknown")
        msg = f"[{self.queue_name}] {event} message_id={msg_id} receive_count={receive_count}"
        if success is not None:
            msg += f" success={success}"
        logger.info(msg)

    def _handle_message(self, message: Dict[str, Any]) -> bool:
        """
        Process a single message. Returns True if processed successfully (message will be deleted).
        """
        msg_id = message.get("MessageId", "unknown")
        receipt_handle = message.get("ReceiptHandle", "")
        body_str = message.get("Body", "{}")

        self._log_message_event("processing", message)

        try:
            body = json.loads(body_str)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in message message_id={msg_id} error={e} body_preview={body_str[:200]}")
            # Delete malformed messages to prevent infinite retries
            self._delete_message(receipt_handle, msg_id)
            return True  # Consider "handled" - we removed the bad message

        try:
            success = self.process_message(body)
            if success:
                self._delete_message(receipt_handle, msg_id)
                self._log_message_event("processed", message, success=True)
                return True
            else:
                logger.warning(f"Processing returned False - message will retry message_id={msg_id}")
                return False
        except Exception as e:
            logger.error(f"Processing failed message_id={msg_id} error={e}\n{traceback.format_exc()}")
            # Don't delete - message will become visible again for retry
            return False

    def _delete_message(self, receipt_handle: str, message_id: str):
        """Delete message from queue after successful processing."""
        if not self.sqs or not self.queue_url:
            return
        try:
            self.sqs.delete_message(
                QueueUrl=self.queue_url,
                ReceiptHandle=receipt_handle,
            )
            logger.debug(f"Deleted message message_id={message_id}")
        except Exception as e:
            logger.error(f"Failed to delete message message_id={message_id} error={e}")

    @abstractmethod
    def process_message(self, body: Dict[str, Any]) -> bool:
        """
        Process the message body. Return True on success, False on failure.
        On False, message will not be deleted and will retry.
        """
        pass

    def poll(self):
        """Main polling loop."""
        logger.info(f"Starting {self.queue_name} consumer...")

        if not self.sqs or not self.queue_url:
            logger.info(f"{self.queue_name}: Mock mode - no SQS configured")
            while not self._shutdown:
                time.sleep(10)
            return

        consecutive_errors = 0
        max_consecutive_errors = 10
        error_backoff = 5

        while not self._shutdown:
            try:
                response = self.sqs.receive_message(
                    QueueUrl=self.queue_url,
                    MaxNumberOfMessages=self.max_messages,
                    WaitTimeSeconds=self.wait_time_seconds,
                    VisibilityTimeout=self.visibility_timeout,
                    MessageAttributeNames=["All"],
                    AttributeNames=["All"],
                )

                messages = response.get("Messages", [])
                consecutive_errors = 0  # Reset on successful poll

                for message in messages:
                    if self._shutdown:
                        break
                    self._handle_message(message)

            except Exception as e:
                consecutive_errors += 1
                logger.error(f"Poll error (attempt {consecutive_errors}/{max_consecutive_errors}): {e}\n{traceback.format_exc()}")
                if consecutive_errors >= max_consecutive_errors:
                    logger.error("Max consecutive errors reached - backing off 60s")
                    time.sleep(60)
                    consecutive_errors = 0
                else:
                    time.sleep(error_backoff)

    def shutdown(self):
        """Signal consumer to stop gracefully."""
        self._shutdown = True
