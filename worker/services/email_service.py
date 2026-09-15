import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from utils.logger import setup_logger

logger = setup_logger(__name__)

# HubSpot SMTP: https://developers.hubspot.com/docs/api/marketing/transactional-emails
HUBSPOT_SMTP_HOST = "smtp.hubapi.com"
HUBSPOT_SMTP_PORT = 587


class EmailService:
    """Send transactional emails via HubSpot SMTP. Logs only when credentials not configured."""

    def __init__(self):
        self.smtp_user = os.getenv("HUBSPOT_SMTP_USER")
        self.smtp_password = os.getenv("HUBSPOT_SMTP_PASSWORD")
        self.from_email = os.getenv("HUBSPOT_FROM_EMAIL", "noreply@chtplatform.com")

        if not self.smtp_user or not self.smtp_password:
            logger.warning(
                "HubSpot SMTP credentials not configured (HUBSPOT_SMTP_USER, HUBSPOT_SMTP_PASSWORD) - emails will be logged only"
            )
            self.enabled = False
        else:
            self.enabled = True
            logger.info("HubSpot email service initialized")

    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """
        Send email via HubSpot SMTP or log when credentials not configured.
        """
        if not self.enabled:
            logger.info(f"[EMAIL MOCK] To: {to_email}, Subject: {subject}")
            logger.debug(f"Content: {html_content[:100]}...")
            return True

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.from_email
            msg["To"] = to_email

            msg.attach(MIMEText(html_content, "html"))

            assert self.smtp_user is not None and self.smtp_password is not None  # guarded by self.enabled
            with smtplib.SMTP(HUBSPOT_SMTP_HOST, HUBSPOT_SMTP_PORT) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, to_email, msg.as_string())

            logger.info(f"Email sent to {to_email} via HubSpot")
            return True

        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
