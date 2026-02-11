"""Tests for PaymentConsumer with mocked dependencies."""
from unittest.mock import patch


@patch.dict("os.environ", {"SQS_PAYMENT_QUEUE_URL": "", "STRIPE_SECRET_KEY": ""}, clear=False)
@patch("consumers.payment_consumer.boto3")
def test_payment_consumer_validate_message_valid(boto_mock):
    """Valid PROCESS_PAYMENT message passes validation."""
    from consumers.payment_consumer import PaymentConsumer

    consumer = PaymentConsumer()
    body = {
        "type": "PROCESS_PAYMENT",
        "userId": "user-123",
        "amount": 1000,
        "paymentType": "PROGRAM_FEE",
    }
    valid, err = consumer._validate_message(body)
    assert valid is True
    assert err is None


@patch.dict("os.environ", {"SQS_PAYMENT_QUEUE_URL": "", "STRIPE_SECRET_KEY": ""}, clear=False)
@patch("consumers.payment_consumer.boto3")
def test_payment_consumer_validate_message_wrong_type(boto_mock):
    """Wrong type fails validation."""
    from consumers.payment_consumer import PaymentConsumer

    consumer = PaymentConsumer()
    body = {
        "type": "OTHER",
        "userId": "user-123",
        "amount": 1000,
        "paymentType": "PROGRAM_FEE",
    }
    valid, err = consumer._validate_message(body)
    assert valid is False
    assert err is not None and "Unknown type" in err


@patch.dict("os.environ", {"SQS_PAYMENT_QUEUE_URL": "", "STRIPE_SECRET_KEY": ""}, clear=False)
@patch("consumers.payment_consumer.boto3")
def test_payment_consumer_validate_message_missing_user_id(boto_mock):
    """Missing userId fails validation."""
    from consumers.payment_consumer import PaymentConsumer

    consumer = PaymentConsumer()
    body = {"type": "PROCESS_PAYMENT", "amount": 1000, "paymentType": "PROGRAM_FEE"}
    valid, err = consumer._validate_message(body)
    assert valid is False
    assert err is not None and "userId" in err


@patch.dict("os.environ", {"SQS_PAYMENT_QUEUE_URL": "", "STRIPE_SECRET_KEY": ""}, clear=False)
@patch("consumers.payment_consumer.boto3")
def test_payment_consumer_validate_message_invalid_amount(boto_mock):
    """Invalid amount fails validation."""
    from consumers.payment_consumer import PaymentConsumer

    consumer = PaymentConsumer()
    body = {
        "type": "PROCESS_PAYMENT",
        "userId": "user-123",
        "amount": "not-a-number",
        "paymentType": "PROGRAM_FEE",
    }
    valid, err = consumer._validate_message(body)
    assert valid is False
    assert err is not None and "amount" in err.lower()
