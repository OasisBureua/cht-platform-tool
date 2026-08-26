"""Tests for CMEConsumer with mocked dependencies."""
import io
from unittest.mock import patch


@patch.dict(
    "os.environ",
    {
        "SQS_CME_QUEUE_URL": "",
        "AWS_ACCESS_KEY_ID": "",
        "AWS_SECRET_ACCESS_KEY": "",
    },
    clear=False,
)
@patch("consumers.cme_consumer.boto3")
def test_cme_consumer_validate_message_valid(boto_mock):
    """Valid GENERATE_CERTIFICATE message passes validation."""
    from consumers.cme_consumer import CMEConsumer

    consumer = CMEConsumer()
    body = {
        "type": "GENERATE_CERTIFICATE",
        "userId": "user-123",
        "programId": "prog-456",
        "credits": 1.5,
    }
    valid, err = consumer._validate_message(body)
    assert valid is True
    assert err is None


@patch.dict(
    "os.environ",
    {
        "SQS_CME_QUEUE_URL": "",
        "AWS_ACCESS_KEY_ID": "",
        "AWS_SECRET_ACCESS_KEY": "",
    },
    clear=False,
)
@patch("consumers.cme_consumer.boto3")
def test_cme_consumer_validate_message_wrong_type(boto_mock):
    """Wrong type fails validation."""
    from consumers.cme_consumer import CMEConsumer

    consumer = CMEConsumer()
    body = {
        "type": "OTHER",
        "userId": "user-123",
        "programId": "prog-456",
        "credits": 1.5,
    }
    valid, err = consumer._validate_message(body)
    assert valid is False
    assert "Unknown type" in err


@patch.dict(
    "os.environ",
    {
        "SQS_CME_QUEUE_URL": "",
        "AWS_ACCESS_KEY_ID": "",
        "AWS_SECRET_ACCESS_KEY": "",
    },
    clear=False,
)
@patch("consumers.cme_consumer.boto3")
def test_cme_consumer_validate_message_missing_credits(boto_mock):
    """Missing credits fails validation."""
    from consumers.cme_consumer import CMEConsumer

    consumer = CMEConsumer()
    body = {
        "type": "GENERATE_CERTIFICATE",
        "userId": "user-123",
        "programId": "prog-456",
    }
    valid, err = consumer._validate_message(body)
    assert valid is False
    assert "credits" in err.lower()


@patch.dict(
    "os.environ",
    {
        "SQS_CME_QUEUE_URL": "",
        "AWS_ACCESS_KEY_ID": "",
        "AWS_SECRET_ACCESS_KEY": "",
    },
    clear=False,
)
@patch("consumers.cme_consumer.boto3")
def test_cme_consumer_generate_certificate_pdf(boto_mock):
    """PDF generation produces valid PDF bytes."""
    from consumers.cme_consumer import CMEConsumer

    consumer = CMEConsumer()
    pdf_buffer = consumer._generate_certificate_pdf(
        user_name="John Doe",
        program_title="Diabetes Care",
        credits=1.5,
        date_str="January 15, 2025",
    )

    assert isinstance(pdf_buffer, io.BytesIO)
    data = pdf_buffer.read()
    assert len(data) > 100
    assert data.startswith(b"%PDF")
