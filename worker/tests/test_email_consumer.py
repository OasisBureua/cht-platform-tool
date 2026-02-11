"""Tests for EmailConsumer with mocked dependencies."""
from unittest.mock import patch


@patch.dict("os.environ", {"SQS_EMAIL_QUEUE_URL": ""}, clear=False)
@patch("consumers.email_consumer.EmailService")
@patch("consumers.email_consumer.boto3")
def test_email_consumer_validate_message_valid(boto_mock, email_service_mock):
    """Valid SEND_EMAIL message passes validation."""
    from consumers.email_consumer import EmailConsumer

    consumer = EmailConsumer()
    body = {"type": "SEND_EMAIL", "to": "a@b.com", "subject": "Hi", "body": "Hello"}
    valid, err = consumer._validate_message(body)
    assert valid is True
    assert err is None


@patch.dict("os.environ", {"SQS_EMAIL_QUEUE_URL": ""}, clear=False)
@patch("consumers.email_consumer.EmailService")
@patch("consumers.email_consumer.boto3")
def test_email_consumer_validate_message_invalid_type(boto_mock, email_service_mock):
    """Wrong type fails validation."""
    from consumers.email_consumer import EmailConsumer

    consumer = EmailConsumer()
    body = {"type": "OTHER", "to": "a@b.com", "subject": "Hi", "body": "Hello"}
    valid, err = consumer._validate_message(body)
    assert valid is False
    assert "Unknown type" in err


@patch.dict("os.environ", {"SQS_EMAIL_QUEUE_URL": ""}, clear=False)
@patch("consumers.email_consumer.EmailService")
@patch("consumers.email_consumer.boto3")
def test_email_consumer_validate_message_missing_to(boto_mock, email_service_mock):
    """Missing 'to' fails validation."""
    from consumers.email_consumer import EmailConsumer

    consumer = EmailConsumer()
    body = {"type": "SEND_EMAIL", "subject": "Hi", "body": "Hello"}
    valid, err = consumer._validate_message(body)
    assert valid is False
    assert "to" in err.lower()


@patch.dict("os.environ", {"SQS_EMAIL_QUEUE_URL": ""}, clear=False)
@patch("consumers.email_consumer.EmailService")
@patch("consumers.email_consumer.boto3")
def test_email_consumer_process_message_success(boto_mock, email_service_mock):
    """process_message succeeds when EmailService returns True."""
    from consumers.email_consumer import EmailConsumer

    email_service_mock.return_value.send_email.return_value = True
    consumer = EmailConsumer()
    body = {"type": "SEND_EMAIL", "to": "a@b.com", "subject": "Hi", "body": "Hello"}

    result = consumer.process_message(body)

    assert result is True
    email_service_mock.return_value.send_email.assert_called_once_with(
        "a@b.com", "Hi", "Hello"
    )


@patch.dict("os.environ", {"SQS_EMAIL_QUEUE_URL": ""}, clear=False)
@patch("consumers.email_consumer.EmailService")
@patch("consumers.email_consumer.boto3")
def test_email_consumer_process_message_invalid_returns_false(boto_mock, email_service_mock):
    """process_message returns False for invalid message."""
    from consumers.email_consumer import EmailConsumer

    consumer = EmailConsumer()
    body = {"type": "SEND_EMAIL", "to": "a@b.com"}  # missing subject, body

    result = consumer.process_message(body)

    assert result is False
    email_service_mock.return_value.send_email.assert_not_called()
