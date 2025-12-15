import boto3
import json
import time
import logging
from typing import Callable, Dict

logger = logging.getLogger(__name__)


class SQSConsumer:
    """
    SQS Consumer for processing messages from a queue
    
    Uses long polling to efficiently receive messages and
    processes them with registered job handlers.
    """
    
    def __init__(self, queue_url: str, job_handlers: Dict[str, Callable], region: str = 'us-east-1'):
        """
        Initialize SQS Consumer
        
        Args:
            queue_url: SQS queue URL
            job_handlers: Dict mapping job types to handler functions
            region: AWS region
        """
        self.sqs = boto3.client('sqs', region_name=region)
        self.queue_url = queue_url
        self.job_handlers = job_handlers
        self.running = False
        
        logger.info(f"SQS Consumer initialized for queue: {queue_url}")
        logger.info(f"Registered handlers: {list(job_handlers.keys())}")
    
    def start(self):
        """Start consuming messages from SQS"""
        self.running = True
        logger.info(f"Starting SQS consumer for queue: {self.queue_url}")
        
        while self.running:
            try:
                # Receive messages (long polling)
                response = self.sqs.receive_message(
                    QueueUrl=self.queue_url,
                    MaxNumberOfMessages=10,  # Process up to 10 at once
                    WaitTimeSeconds=20,  # Long polling (20 seconds)
                    MessageAttributeNames=['All'],
                    AttributeNames=['All']
                )
                
                messages = response.get('Messages', [])
                
                if not messages:
                    logger.debug("No messages received, continuing...")
                    continue
                
                logger.info(f"Received {len(messages)} messages")
                
                # Process each message
                for message in messages:
                    self.process_message(message)
            
            except Exception as e:
                logger.error(f"Error in consumer loop: {e}", exc_info=True)
                time.sleep(5)  # Wait before retrying
    
    def process_message(self, message: dict):
        """Process a single SQS message"""
        receipt_handle = message['ReceiptHandle']
        
        try:
            # Parse message body
            body = json.loads(message['Body'])
            job_type = body.get('jobType')
            payload = body.get('payload', {})
            metadata = body.get('metadata', {})
            
            logger.info(f"Processing job: {job_type}")
            logger.debug(f"Payload: {payload}")
            
            # Get handler for this job type
            handler = self.job_handlers.get(job_type)
            
            if not handler:
                logger.error(f"No handler found for job type: {job_type}")
                # Delete message to prevent reprocessing
                self.delete_message(receipt_handle)
                return
            
            # Execute handler with payload
            result = handler(**payload)
            
            logger.info(f"Job completed: {job_type} - Result: {result}")
            
            # Delete message from queue (success)
            self.delete_message(receipt_handle)
        
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse message body: {e}")
            # Delete malformed message
            self.delete_message(receipt_handle)
        
        except TypeError as e:
            logger.error(f"Invalid payload for job handler: {e}", exc_info=True)
            # Delete message with invalid payload
            self.delete_message(receipt_handle)
        
        except Exception as e:
            logger.error(f"Failed to process message: {e}", exc_info=True)
            # Don't delete - will retry automatically
            # After max retries, goes to DLQ
    
    def delete_message(self, receipt_handle: str):
        """Delete message from queue"""
        try:
            self.sqs.delete_message(
                QueueUrl=self.queue_url,
                ReceiptHandle=receipt_handle
            )
            logger.debug("Message deleted from queue")
        except Exception as e:
            logger.error(f"Failed to delete message: {e}")
    
    def stop(self):
        """Stop the consumer"""
        self.running = False
        logger.info("Stopping SQS consumer")
