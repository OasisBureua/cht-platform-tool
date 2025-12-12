"""
CME certificate generation jobs
"""
from celery import Task
from app.celery_app import celery_app
from app.database import SessionLocal
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

@celery_app.task(name="generate_cme_certificate")
def generate_cme_certificate(user_id: str, program_id: str, credits: float):
    """
    Generate CME certificate PDF
    
    Args:
        user_id: User ID
        program_id: Program ID
        credits: Number of CME credits earned
    """
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
        from io import BytesIO

        # Create PDF in memory
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter

        # Add certificate content
        p.setFont("Helvetica-Bold", 24)
        p.drawCentredString(width / 2, height - 100, "Certificate of Completion")
        
        p.setFont("Helvetica", 14)
        p.drawCentredString(width / 2, height - 150, "This certifies that")
        
        p.setFont("Helvetica-Bold", 18)
        p.drawCentredString(width / 2, height - 200, "[User Name]")  # TODO: Get actual name
        
        p.setFont("Helvetica", 14)
        p.drawCentredString(width / 2, height - 250, "has successfully completed")
        
        p.setFont("Helvetica-Bold", 16)
        p.drawCentredString(width / 2, height - 300, "[Program Title]")  # TODO: Get actual title
        
        p.setFont("Helvetica", 14)
        p.drawCentredString(width / 2, height - 350, f"and earned {credits} CME credits")
        
        p.setFont("Helvetica", 12)
        p.drawCentredString(width / 2, height - 400, f"Date: {datetime.utcnow().strftime('%B %d, %Y')}")
        
        p.save()

        # Get PDF bytes
        pdf_bytes = buffer.getvalue()
        buffer.close()

        # TODO: Upload to S3
        certificate_url = f"https://example.com/certificates/{user_id}-{program_id}.pdf"
        
        logger.info(f"Certificate generated for user {user_id}")
        
        # Send email with certificate
        from app.jobs.email_jobs import send_cme_certificate_email
        send_cme_certificate_email.delay("user@example.com", certificate_url)
        
        return {
            "status": "success",
            "certificate_url": certificate_url
        }
    
    except Exception as e:
        logger.error(f"Certificate generation failed: {str(e)}")
        return {"status": "failed", "error": str(e)}