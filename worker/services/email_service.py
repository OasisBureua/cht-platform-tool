import os

from utils.logger import setup_logger

logger = setup_logger(__name__)


class EmailService:
    """Send transactional emails via Amazon SES. Logs only when SES not configured."""

    def __init__(self):
        self.from_email = os.getenv("SES_FROM_EMAIL", "noreply@chtplatform.com")
        self.aws_region = os.getenv("AWS_REGION", "us-east-1")

        # SES uses IAM role in ECS; no credentials needed when running in AWS
        self.enabled = True
        logger.info("Email service initialized (Amazon SES)")

    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """
        Send email via Amazon SES or log when not in AWS.
        """
        try:
            import boto3

            client = boto3.client("ses", region_name=self.aws_region)
            client.send_email(
                Source=self.from_email,
                Destination={"ToAddresses": [to_email]},
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": html_content, "Charset": "UTF-8"},
                    },
                },
            )
            logger.info(f"Email sent to {to_email} via SES")
            return True

        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
