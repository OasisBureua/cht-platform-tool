"""Email consumer — not yet implemented."""
from utils.sqs_base import PermanentFailure, SQSBaseConsumer  # noqa: F401


class EmailConsumer(SQSBaseConsumer):
    def process_message(self, body: dict) -> bool:
        raise NotImplementedError("EmailConsumer is not yet implemented")
