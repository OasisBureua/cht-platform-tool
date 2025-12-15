import logging
import signal
import sys
from concurrent.futures import ThreadPoolExecutor
from app.sqs_consumer import SQSConsumer
from app.config import settings
from app.jobs import email_jobs, payment_jobs, cme_jobs

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Job handlers registry
EMAIL_HANDLERS = {
    'send_welcome_email': email_jobs.send_welcome_email,
    'send_enrollment_confirmation': email_jobs.send_enrollment_confirmation,
    'send_cme_certificate_email': email_jobs.send_cme_certificate_email,
}

PAYMENT_HANDLERS = {
    'process_payment': payment_jobs.process_payment,
    'process_honorarium': payment_jobs.process_honorarium,
}

CME_HANDLERS = {
    'generate_cme_certificate': cme_jobs.generate_cme_certificate,
}


class WorkerApp:
    """Main worker application"""
    
    def __init__(self):
        self.consumers = []
        self.executor = ThreadPoolExecutor(max_workers=3)
        
        # Create consumers for each queue
        if settings.SQS_EMAIL_QUEUE_URL:
            self.email_consumer = SQSConsumer(
                queue_url=settings.SQS_EMAIL_QUEUE_URL,
                job_handlers=EMAIL_HANDLERS,
                region=settings.AWS_REGION
            )
            self.consumers.append(('email', self.email_consumer))
        else:
            logger.warning("Email queue URL not configured")
        
        if settings.SQS_PAYMENT_QUEUE_URL:
            self.payment_consumer = SQSConsumer(
                queue_url=settings.SQS_PAYMENT_QUEUE_URL,
                job_handlers=PAYMENT_HANDLERS,
                region=settings.AWS_REGION
            )
            self.consumers.append(('payment', self.payment_consumer))
        else:
            logger.warning("Payment queue URL not configured")
        
        if settings.SQS_CME_QUEUE_URL:
            self.cme_consumer = SQSConsumer(
                queue_url=settings.SQS_CME_QUEUE_URL,
                job_handlers=CME_HANDLERS,
                region=settings.AWS_REGION
            )
            self.consumers.append(('cme', self.cme_consumer))
        else:
            logger.warning("CME queue URL not configured")
        
        if not self.consumers:
            logger.error("No queue URLs configured! Worker will not process any jobs.")
    
    def start(self):
        """Start all consumers"""
        logger.info("=" * 60)
        logger.info("Starting CHT Platform Worker")
        logger.info(f"Environment: {settings.ENVIRONMENT}")
        logger.info(f"AWS Region: {settings.AWS_REGION}")
        logger.info(f"Active consumers: {len(self.consumers)}")
        logger.info("=" * 60)
        
        # Register signal handlers for graceful shutdown
        signal.signal(signal.SIGTERM, self.shutdown)
        signal.signal(signal.SIGINT, self.shutdown)
        
        # Start each consumer in separate thread
        for name, consumer in self.consumers:
            logger.info(f"Starting {name} consumer...")
            self.executor.submit(consumer.start)
        
        logger.info("All consumers started. Worker is running...")
        logger.info("Press Ctrl+C to stop.")
        
        # Keep main thread alive
        try:
            while True:
                signal.pause()
        except KeyboardInterrupt:
            self.shutdown(None, None)
    
    def shutdown(self, signum, frame):
        """Graceful shutdown"""
        logger.info("=" * 60)
        logger.info("Shutting down workers...")
        logger.info("=" * 60)
        
        for name, consumer in self.consumers:
            logger.info(f"Stopping {name} consumer...")
            consumer.stop()
        
        self.executor.shutdown(wait=True)
        logger.info("Shutdown complete. Goodbye!")
        sys.exit(0)


if __name__ == '__main__':
    app = WorkerApp()
    app.start()
