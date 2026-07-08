"""CME consumer — not yet implemented."""
from utils.sqs_base import PermanentFailure, SQSBaseConsumer  # noqa: F401


class CmeConsumer(SQSBaseConsumer):
    def process_message(self, body: dict) -> bool:
        raise NotImplementedError("CmeConsumer is not yet implemented")
