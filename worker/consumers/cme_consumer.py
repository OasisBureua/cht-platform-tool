import os
import json
import time
import boto3
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from sqlalchemy import text
from utils.logger import setup_logger
from services.database import get_db_session
import io

logger = setup_logger(__name__)

class CMEConsumer:
    def __init__(self):
        self.queue_url = os.getenv('SQS_CME_QUEUE_URL')
        
        # Initialize S3
        s3_configured = os.getenv('AWS_ACCESS_KEY_ID') and os.getenv('AWS_SECRET_ACCESS_KEY')
        if s3_configured:
            self.s3 = boto3.client('s3', region_name=os.getenv('AWS_REGION', 'us-east-1'))
            self.bucket = os.getenv('S3_CERTIFICATES_BUCKET', 'cht-platform-certificates-dev')
            logger.info(f'S3 initialized with bucket: {self.bucket}')
        else:
            logger.warning('S3 not configured - certificates will be mocked')
            self.s3 = None
        
        if not self.queue_url:
            logger.warning('SQS_CME_QUEUE_URL not configured - running in mock mode')
            self.sqs = None
        else:
            self.sqs = boto3.client('sqs', region_name=os.getenv('AWS_REGION', 'us-east-1'))
            logger.info(f'CME consumer initialized with queue: {self.queue_url}')

    def generate_certificate_pdf(self, user_name: str, program_title: str, credits: float, date: str):
        """
        Generate CME certificate PDF
        """
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        
        # Title
        c.setFont("Helvetica-Bold", 36)
        c.drawCentredString(width/2, height - 2*inch, "Certificate of Completion")
        
        # Body
        c.setFont("Helvetica", 16)
        c.drawCentredString(width/2, height - 3*inch, "This certifies that")
        
        c.setFont("Helvetica-Bold", 24)
        c.drawCentredString(width/2, height - 3.5*inch, user_name)
        
        c.setFont("Helvetica", 16)
        c.drawCentredString(width/2, height - 4.5*inch, "has successfully completed")
        
        c.setFont("Helvetica-Bold", 20)
        c.drawCentredString(width/2, height - 5.2*inch, program_title)
        
        c.setFont("Helvetica", 16)
        c.drawCentredString(width/2, height - 6.2*inch, f"and earned {credits} CME credits")
        
        c.setFont("Helvetica", 12)
        c.drawCentredString(width/2, height - 7.5*inch, f"Date: {date}")
        
        # Footer
        c.setFont("Helvetica-Oblique", 10)
        c.drawCentredString(width/2, 1*inch, "CHT Platform - Healthcare Education")
        
        c.save()
        buffer.seek(0)
        return buffer

    def generate_certificate(self, user_id: str, program_id: str, credits: float):
        """
        Generate and upload CME certificate
        """
        logger.info(f'Generating certificate for user {user_id}, program {program_id}')
        
        try:
            # Get user and program details
            with get_db_session() as session:
                user_result = session.execute(
                    text('SELECT "firstName", "lastName", email FROM "User" WHERE id = :user_id'),
                    {"user_id": user_id}
                ).fetchone()
                
                program_result = session.execute(
                    text('SELECT title FROM "Program" WHERE id = :program_id'),
                    {"program_id": program_id}
                ).fetchone()
                
                if not user_result or not program_result:
                    raise Exception('User or program not found')
                
                user_name = f"{user_result[0]} {user_result[1]}"
                program_title = program_result[0]
                email = user_result[2]
            
            # Generate PDF
            pdf_buffer = self.generate_certificate_pdf(
                user_name,
                program_title,
                credits,
                datetime.now().strftime("%B %d, %Y")
            )
            
            # Upload to S3 or mock
            if self.s3:
                certificate_key = f"certificates/{user_id}/{program_id}.pdf"
                self.s3.upload_fileobj(
                    pdf_buffer,
                    self.bucket,
                    certificate_key,
                    ExtraArgs={'ContentType': 'application/pdf'}
                )
                certificate_url = f"https://{self.bucket}.s3.amazonaws.com/{certificate_key}"
                logger.info(f'Certificate uploaded: {certificate_url}')
            else:
                certificate_url = f"mock://certificates/{user_id}/{program_id}.pdf"
                logger.info(f'[CERTIFICATE MOCK] Generated for {user_name}')
            
            # Save to database
            with get_db_session() as session:
                session.execute(
                    text('''
                        INSERT INTO "CMECredit"
                        (id, "userId", "programId", credits, "certificateUrl", "issuedAt")
                        VALUES
                        (gen_random_uuid()::text, :user_id, :program_id, :credits, :url, NOW())
                    '''),
                    {
                        "user_id": user_id,
                        "program_id": program_id,
                        "credits": credits,
                        "url": certificate_url
                    }
                )
            
            logger.info(f'CME certificate generated for {user_name}')
            return True
            
        except Exception as e:
            logger.error(f'Failed to generate certificate: {str(e)}')
            return False

    def process_message(self, message_body: dict):
        """
        Process CME message
        """
        msg_type = message_body.get('type')
        
        if msg_type == 'GENERATE_CERTIFICATE':
            return self.generate_certificate(
                message_body['userId'],
                message_body['programId'],
                message_body['credits']
            )
        else:
            logger.warning(f'Unknown message type: {msg_type}')
            return False

    def poll_queue(self):
        """
        Poll SQS queue for CME jobs
        """
        logger.info('Starting CME consumer...')
        
        if not self.sqs:
            logger.info('Running in mock mode - no actual polling')
            while True:
                time.sleep(10)
                logger.debug('Mock mode: waiting for queue configuration')
            return

        while True:
            try:
                response = self.sqs.receive_message(
                    QueueUrl=self.queue_url,
                    MaxNumberOfMessages=10,
                    WaitTimeSeconds=20,
                    VisibilityTimeout=300
                )
                
                messages = response.get('Messages', [])
                
                if not messages:
                    continue
                
                logger.info(f'Received {len(messages)} CME messages')
                
                for message in messages:
                    try:
                        body = json.loads(message['Body'])
                        logger.info(f"Generating certificate for user {body.get('userId')}")
                        
                        success = self.process_message(body)
                        
                        if success:
                            self.sqs.delete_message(
                                QueueUrl=self.queue_url,
                                ReceiptHandle=message['ReceiptHandle']
                            )
                            logger.info('Certificate generated and message deleted')
                        
                    except Exception as e:
                        logger.error(f'Error processing CME message: {e}')
                        
            except Exception as e:
                logger.error(f'Error polling CME queue: {e}')
                time.sleep(5)

def run():
    """
    Run CME consumer
    """
    consumer = CMEConsumer()
    consumer.poll_queue()

if __name__ == '__main__':
    run()
