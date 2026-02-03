import os
import json
import time
import boto3
from utils.logger import setup_logger
from services.email_service import EmailService

logger = setup_logger(__name__)

class EmailConsumer:
    def __init__(self):
        self.queue_url = os.getenv('SQS_EMAIL_QUEUE_URL')
        self.email_service = EmailService()
        
        if not self.queue_url:
            logger.warning('SQS_EMAIL_QUEUE_URL not configured - running in mock mode')
            self.sqs = None
        else:
            self.sqs = boto3.client('sqs', region_name=os.getenv('AWS_REGION', 'us-east-1'))
            logger.info(f'Email consumer initialized with queue: {self.queue_url}')

    def process_message(self, message_body: dict):
        """
        Process email message
        """
        msg_type = message_body.get('type')
        
        if msg_type == 'SEND_EMAIL':
            return self.email_service.send_email(
                message_body['to'],
                message_body['subject'],
                message_body['body']
            )
        else:
            logger.warning(f'Unknown message type: {msg_type}')
            return False

    def poll_queue(self):
        """
        Poll SQS queue for email jobs
        """
        logger.info('Starting email consumer...')
        
        if not self.sqs:
            logger.info('Running in mock mode - no actual polling')
            while True:
                time.sleep(10)
                logger.debug('Mock mode: waiting for queue configuration')
            return

        while True:
            try:
                # Receive messages from SQS
                response = self.sqs.receive_message(
                    QueueUrl=self.queue_url,
                    MaxNumberOfMessages=10,
                    WaitTimeSeconds=20,  # Long polling
                    VisibilityTimeout=300  # 5 minutes
                )
                
                messages = response.get('Messages', [])
                
                if not messages:
                    logger.debug('No messages in queue')
                    continue
                
                logger.info(f'Received {len(messages)} messages')
                
                for message in messages:
                    try:
                        body = json.loads(message['Body'])
                        logger.info(f"Processing: {body.get('type')}")
                        
                        # Process the message
                        success = self.process_message(body)
                        
                        if success:
                            # Delete message after successful processing
                            self.sqs.delete_message(
                                QueueUrl=self.queue_url,
                                ReceiptHandle=message['ReceiptHandle']
                            )
                            logger.info('Message processed and deleted')
                        else:
                            logger.error('Message processing failed - will retry')
                        
                    except json.JSONDecodeError as e:
                        logger.error(f'Invalid JSON: {e}')
                        # Delete malformed message
                        self.sqs.delete_message(
                            QueueUrl=self.queue_url,
                            ReceiptHandle=message['ReceiptHandle']
                        )
                    except Exception as e:
                        logger.error(f'Error processing message: {e}')
                        # Message will be retried or go to DLQ
                        
            except Exception as e:
                logger.error(f'Error polling queue: {e}')
                time.sleep(5)  # Wait before retrying

def run():
    """
    Run email consumer
    """
    consumer = EmailConsumer()
    consumer.poll_queue()

if __name__ == '__main__':
    run()
