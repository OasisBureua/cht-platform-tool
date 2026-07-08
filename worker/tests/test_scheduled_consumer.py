"""Unit tests for ScheduledConsumer."""
import pytest
from unittest.mock import MagicMock, patch

from utils.sqs_base import PermanentFailure


class TestScheduledConsumerDispatch:
    """process_message() routing."""

    def _make_consumer(self):
        with patch.dict("os.environ", {}, clear=False):
            # Patch boto3.client so __init__ doesn't need real AWS creds
            with patch("consumers.scheduled_consumer.boto3"):
                from consumers.scheduled_consumer import ScheduledConsumer
                c = ScheduledConsumer.__new__(ScheduledConsumer)
                c.queue_url = None
                c.sqs = None
                c.queue_name = "scheduled-jobs"
                c.visibility_timeout = 900
                c.max_messages = 1
                c.wait_time_seconds = 20
                c._shutdown = False
                return c

    def test_unknown_type_raises_permanent_failure(self):
        consumer = self._make_consumer()
        with pytest.raises(PermanentFailure, match="Unknown scheduled job type"):
            consumer.process_message({"type": "NOT_A_REAL_JOB"})

    def test_missing_type_raises_permanent_failure(self):
        consumer = self._make_consumer()
        with pytest.raises(PermanentFailure):
            consumer.process_message({})

    def test_session_reminders_skips_when_ses_not_configured(self):
        """When SES_FROM_EMAIL is absent the scan is skipped but returns True."""
        consumer = self._make_consumer()
        with patch.dict("os.environ", {"SES_FROM_EMAIL": ""}, clear=False):
            result = consumer._session_reminders()
        assert result is True

    def test_session_reminders_dispatches_from_process_message(self):
        consumer = self._make_consumer()
        with patch.object(consumer, "_session_reminders", return_value=True) as mock_scan:
            result = consumer.process_message({"type": "SESSION_REMINDERS"})
        mock_scan.assert_called_once()
        assert result is True
