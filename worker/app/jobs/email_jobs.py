"""
Email sending jobs
"""
from celery import Task
from app.celery_app import celery_app
from app.config import settings
import logging

logger = logging.getLogger(__name__)

@celery_app.task(name="send_email", bind=True, max_retries=3)
def send_email(self: Task, to_email: str, subject: str, html_content: str):
    """
    Send email via SendGrid
    
    Args:
        to_email: Recipient email
        subject: Email subject
        html_content: HTML email content
    """
    try:
        # Check if SendGrid is configured
        if not settings.SENDGRID_API_KEY:
            logger.warning("SedGrid not configured, skipping email")
            return {"status": "skipped", "reason": "SendGrid not configured"}
        
        # Import here to avoid errors if SendGrid is not installed
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=settings.SENDGRID_FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            html_content=html_content
        )

        sg = SendGridAPIClient(settings.SENNDGRID_API_KEY)
        response = sg.send(message)

        logger.info(f"Email sent to {to_email}: {response.status_code}")
        return {
            "status": "success",
            "status_code": response.status_code
        }
    except Exception as e:
        logger.error(f"Email failed: {str(e)}")
        # Retry with exponential backoff
        self.retry(exc=e, countdown=60 * (2 ** self.request.retries))

@celery_app.task(name="send_welcome_email")
def send_welcome_email(user_email: str, user_name: str):
    """Send welcome email to new user"""
    subject = "Welcome to CHT Platform"
    html_content = f"""
    <html>
        <body>
            <h1>Welcome to CHT Platform, {user_name}!</h1>
            <p>Thank you for joining our healthcare education platform.</p>
            <p>You can now:</p>
            <ul>
                <li>Browse CME programs</li>
                <li>Track your progress</li>
                <li>Earn CME credits</li>
            </ul>
            <p>Get started by exploring our programs!</p>
        </body>
    </html>
    """
    
    send_email.delay(user_email, subject, html_content)
    logger.info(f"Welcome email queued for {user_email}")

@celery_app.task(name="send_enrollment_confirmation")
def send_enrollment_confirmation(user_email: str, program_title: str):
    """Send enrollment confirmation email"""
    subject = f"Enrolled in {program_title}"
    html_content = f"""
    <html>
        <body>
            <h1>Enrollment Confirmed!</h1>
            <p>You have been successfully enrolled in <strong>{program_title}</strong>.</p>
            <p>Start watching videos to begin earning CME credits.</p>
        </body>
    </html>
    """
    
    send_email.delay(user_email, subject, html_content)

@celery_app.task(name="send_cme_certificate_email")
def send_cme_certificate_email(user_email: str, certificate_url: str):
    """Send CME certificate email"""
    subject = "Your CME Certificate is Ready"
    html_content = f"""
    <html>
        <body>
            <h1>Congratulations!</h1>
            <p>Your CME certificate is ready for download.</p>
            <p><a href="{certificate_url}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; display: inline-block;">Download Certificate</a></p>
        </body>
    </html>
    """
    
    send_email.delay(user_email, subject, html_content)