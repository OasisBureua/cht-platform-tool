import os
import json
import time
import boto3
import stripe
from typing import Optional
from sqlalchemy import text
from utils.logger import setup_logger
from services.database import get_db_session

logger = setup_logger(__name__)

class PaymentConsumer:
    def __init__(self):
        self.queue_url = os.getenv('SQS_PAYMENT_QUEUE_URL')
        
        # Initialize Stripe
        stripe_key = os.getenv('STRIPE_SECRET_KEY')
        if stripe_key:
            stripe.api_key = stripe_key
            logger.info('Stripe initialized')
        else:
            logger.warning('Stripe not configured - running in mock mode')
        
        if not self.queue_url:
            logger.warning('SQS_PAYMENT_QUEUE_URL not configured - running in mock mode')
            self.sqs = None
        else:
            self.sqs = boto3.client('sqs', region_name=os.getenv('AWS_REGION', 'us-east-1'))
            logger.info(f'Payment consumer initialized with queue: {self.queue_url}')

    def process_payment(self, user_id: str, amount: int, payment_type: str, program_id: Optional[str] = None):
        """
        Process payment via Stripe
        """
        logger.info(f'Processing payment: ${amount/100} for user {user_id}')
        
        try:
            # Get user from database
            with get_db_session() as session:
                result = session.execute(
                    text('SELECT "stripeAccountId", email FROM "User" WHERE id = :user_id'),
                    {"user_id": user_id}
                ).fetchone()
                
                if not result:
                    raise Exception(f'User not found: {user_id}')
                
                stripe_account_id = result[0]
                email = result[1]
                
                if not stripe_account_id:
                    logger.warning(f'User {email} does not have Stripe account - skipping payment')
                    return False
            
            # Mock mode if Stripe not configured
            if not stripe.api_key:
                logger.info(f'[PAYMENT MOCK] Transfer ${amount/100} to {stripe_account_id}')
                
                # Still record in database
                with get_db_session() as session:
                    session.execute(
                        text('''
                            INSERT INTO "Payment" 
                            (id, "userId", "programId", amount, type, status, description, "createdAt", "updatedAt", "paidAt")
                            VALUES 
                            (gen_random_uuid()::text, :user_id, :program_id, :amount, :type, 'PAID', :desc, NOW(), NOW(), NOW())
                        '''),
                        {
                            "user_id": user_id,
                            "program_id": program_id,
                            "amount": amount,
                            "type": payment_type,
                            "desc": f'{payment_type} payment (mock)'
                        }
                    )
                    
                    # Update user total earnings
                    session.execute(
                        text('UPDATE "User" SET "totalEarnings" = "totalEarnings" + :amount WHERE id = :user_id'),
                        {"amount": amount, "user_id": user_id}
                    )
                
                logger.info(f'Mock payment recorded for user {user_id}')
                return True
            
            # Real Stripe transfer
            transfer = stripe.Transfer.create(
                amount=amount,
                currency='usd',
                destination=stripe_account_id,
                description=f'{payment_type} payment'
            )
            
            logger.info(f'Stripe transfer created: {transfer.id}')
            
            # Record payment in database
            with get_db_session() as session:
                session.execute(
                    text('''
                        INSERT INTO "Payment" 
                        (id, "userId", "programId", amount, type, status, "stripeTransferId", "createdAt", "updatedAt", "paidAt")
                        VALUES 
                        (gen_random_uuid()::text, :user_id, :program_id, :amount, :type, 'PAID', :transfer_id, NOW(), NOW(), NOW())
                    '''),
                    {
                        "user_id": user_id,
                        "program_id": program_id,
                        "amount": amount,
                        "type": payment_type,
                        "transfer_id": transfer.id
                    }
                )
                
                # Update user total earnings
                session.execute(
                    text('UPDATE "User" SET "totalEarnings" = "totalEarnings" + :amount WHERE id = :user_id'),
                    {"amount": amount, "user_id": user_id}
                )
            
            logger.info(f'Payment recorded for user {user_id}: ${amount/100}')
            return True
            
        except Exception as e:
            logger.error(f'Failed to process payment: {str(e)}')
            return False

    def process_message(self, message_body: dict):
        """
        Process payment message
        """
        msg_type = message_body.get('type')
        
        if msg_type == 'PROCESS_PAYMENT':
            return self.process_payment(
                message_body['userId'],
                message_body['amount'],
                message_body['paymentType'],
                message_body.get('programId')
            )
        else:
            logger.warning(f'Unknown message type: {msg_type}')
            return False

    def poll_queue(self):
        """
        Poll SQS queue for payment jobs
        """
        logger.info('Starting payment consumer...')
        
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
                    VisibilityTimeout=600  # 10 minutes for payments
                )
                
                messages = response.get('Messages', [])
                
                if not messages:
                    continue
                
                logger.info(f'Received {len(messages)} payment messages')
                
                for message in messages:
                    try:
                        body = json.loads(message['Body'])
                        logger.info(f"Processing payment: {body.get('paymentType')}")
                        
                        success = self.process_message(body)
                        
                        if success:
                            self.sqs.delete_message(
                                QueueUrl=self.queue_url,
                                ReceiptHandle=message['ReceiptHandle']
                            )
                            logger.info('Payment processed and message deleted')
                        
                    except Exception as e:
                        logger.error(f'Error processing payment message: {e}')
                        
            except Exception as e:
                logger.error(f'Error polling payment queue: {e}')
                time.sleep(5)

def run():
    """
    Run payment consumer
    """
    consumer = PaymentConsumer()
    consumer.poll_queue()

if __name__ == '__main__':
    run()
