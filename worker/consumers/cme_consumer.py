import os
import io
import boto3
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from sqlalchemy import text

from utils.logger import setup_logger
from utils.sqs_base import SQSBaseConsumer
from services.database import get_db_session

logger = setup_logger(__name__)


class CMEConsumer(SQSBaseConsumer):
    """Process CME certificate messages. Failed messages retry; DLQ handles after max retries."""

    def __init__(self):
        queue_url = os.getenv("SQS_CME_QUEUE_URL")

        s3_configured = os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY")
        if s3_configured:
            self.s3 = boto3.client("s3", region_name=os.getenv("AWS_REGION", "us-east-1"))
            self.bucket = os.getenv("S3_CERTIFICATES_BUCKET", "cht-platform-certificates-dev")
            logger.info(f"S3 initialized with bucket: {self.bucket}")
        else:
            logger.warning("S3 not configured - certificates will be mocked")
            self.s3 = None

        sqs = None
        if queue_url:
            sqs = boto3.client("sqs", region_name=os.getenv("AWS_REGION", "us-east-1"))
            logger.info(f"CME consumer queue: {queue_url}")

        super().__init__(
            queue_url=queue_url,
            sqs_client=sqs,
            queue_name="cme",
            visibility_timeout=300,  # 5 min for PDF gen + S3 upload
        )

    def _validate_message(self, body: dict) -> tuple:
        """Validate required fields. Returns (valid, error_message)."""
        if body.get("type") != "GENERATE_CERTIFICATE":
            return False, f"Unknown type: {body.get('type')}"
        if not body.get("userId"):
            return False, "Missing userId"
        if not body.get("programId"):
            return False, "Missing programId"
        if "credits" not in body:
            return False, "Missing credits"
        return True, None

    def process_message(self, body: dict) -> bool:
        """Process CME certificate message. Returns True on success."""
        valid, err = self._validate_message(body)
        if not valid:
            logger.error(f"Invalid message: {err}")
            return False

        return self._generate_certificate(
            body["userId"],
            body["programId"],
            float(body["credits"]),
        )

    def _generate_certificate_pdf(
        self,
        user_name: str,
        program_title: str,
        credits: float,
        date_str: str,
    ) -> io.BytesIO:
        """Generate CME certificate PDF."""
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter

        c.setFont("Helvetica-Bold", 36)
        c.drawCentredString(width / 2, height - 2 * inch, "Certificate of Completion")

        c.setFont("Helvetica", 16)
        c.drawCentredString(width / 2, height - 3 * inch, "This certifies that")

        c.setFont("Helvetica-Bold", 24)
        c.drawCentredString(width / 2, height - 3.5 * inch, user_name)

        c.setFont("Helvetica", 16)
        c.drawCentredString(width / 2, height - 4.5 * inch, "has successfully completed")

        c.setFont("Helvetica-Bold", 20)
        c.drawCentredString(width / 2, height - 5.2 * inch, program_title)

        c.setFont("Helvetica", 16)
        c.drawCentredString(width / 2, height - 6.2 * inch, f"and earned {credits} CME credits")

        c.setFont("Helvetica", 12)
        c.drawCentredString(width / 2, height - 7.5 * inch, f"Date: {date_str}")

        c.setFont("Helvetica-Oblique", 10)
        c.drawCentredString(width / 2, 1 * inch, "CHT Platform - Healthcare Education")

        c.save()
        buffer.seek(0)
        return buffer

    def _generate_certificate(self, user_id: str, program_id: str, credits: float) -> bool:
        """Generate and store CME certificate."""
        logger.info(f"Generating certificate for user={user_id} program={program_id} credits={credits}")

        try:
            with get_db_session() as session:
                user_result = session.execute(
                    text('SELECT "firstName", "lastName", email FROM "User" WHERE id = :user_id'),
                    {"user_id": user_id},
                ).fetchone()

                program_result = session.execute(
                    text('SELECT title FROM "Program" WHERE id = :program_id'),
                    {"program_id": program_id},
                ).fetchone()

                if not user_result or not program_result:
                    logger.error(f"User or program not found: user={user_id} program={program_id}")
                    return False

                user_name = f"{user_result[0]} {user_result[1]}"
                program_title = program_result[0]

            pdf_buffer = self._generate_certificate_pdf(
                user_name,
                program_title,
                credits,
                datetime.now().strftime("%B %d, %Y"),
            )

            if self.s3:
                certificate_key = f"certificates/{user_id}/{program_id}.pdf"
                self.s3.upload_fileobj(
                    pdf_buffer,
                    self.bucket,
                    certificate_key,
                    ExtraArgs={"ContentType": "application/pdf"},
                )
                certificate_url = f"https://{self.bucket}.s3.amazonaws.com/{certificate_key}"
                logger.info(f"Certificate uploaded: {certificate_url}")
            else:
                certificate_url = f"mock://certificates/{user_id}/{program_id}.pdf"
                logger.info(f"[CERTIFICATE MOCK] Generated for {user_name}")

            with get_db_session() as session:
                session.execute(
                    text("""
                        INSERT INTO "CMECredit"
                        (id, "userId", "programId", credits, "certificateUrl", "issuedAt")
                        VALUES
                        (gen_random_uuid()::text, :user_id, :program_id, :credits, :url, NOW())
                    """),
                    {
                        "user_id": user_id,
                        "program_id": program_id,
                        "credits": credits,
                        "url": certificate_url,
                    },
                )

            logger.info(f"CME certificate generated for {user_name}")
            return True

        except Exception as e:
            logger.error(f"Certificate generation failed: {e}", exc_info=True)
            return False

    def poll_queue(self):
        """Alias for poll() for backward compatibility."""
        self.poll()


def run():
    consumer = CMEConsumer()
    consumer.poll_queue()


if __name__ == "__main__":
    run()
