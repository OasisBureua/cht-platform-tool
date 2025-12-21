import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from utils.logger import setup_logger

logger = setup_logger(__name__)

class EmailService:
    def __init__(self):
        self.api_key = os.getenv('SENDGRID_API_KEY')
        self.from_email = os.getenv('SENDGRID_FROM_EMAIL', 'noreply@chtplatform.com')
        
        if not self.api_key:
            logger.warning('SendGrid API key not configured - emails will be logged only')
            self.client = None
        else:
            self.client = SendGridAPIClient(self.api_key)
            logger.info('SendGrid client initialized')

    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """
        Send email via SendGrid
        """
        if not self.client:
            logger.info(f'[EMAIL MOCK] To: {to_email}, Subject: {subject}')
            logger.debug(f'Content: {html_content[:100]}...')
            return True

        try:
            message = Mail(
                from_email=self.from_email,
                to_emails=to_email,
                subject=subject,
                html_content=html_content
            )
            
            response = self.client.send(message)
            logger.info(f'Email sent to {to_email}. Status: {response.status_code}')
            return True
            
        except Exception as e:
            logger.error(f'Failed to send email: {str(e)}')
            return False