"""
Payment processing jobs
"""
from celery import Task
from app.celery_app import celery_app
from app.config import settings
import logging

logger = logging.getLogger(__name__)

@celery_app.task(name="process_payment", bind=True, max_retries=3)
def process_payment(self: Task, payment_id: str, amount: int, user_id: str):
    """
    Process payment via Stripe
    
    Args:
        payment_id: Payment record ID in database
        amount: Amount in cents (e.g., 5000 = $50.00)
        user_id: User ID
    """
    try:
        if not settings.STRIPE_SECRET_KEY:
            logger.warning("Stripe not configured, skipping payment")
            return {"status": "skipped", "reason": "Stripe not configured"}
        
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY

        # Create payment intent
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="usd",
            metadata={
                "payment_id": payment_id,
                "user_id": user_id
            }
        )

        logger.info(f"Payment intent created: {intent.id}")
        return {
            "status": "success",
            "payment_intent_id": intent.id,
            "client_secret": intent.client_secret
        }

    except Exception as e:
        logger.error(f"Payment failed: {str(e)}")
        self.retry(exc=e, countdown=60 * (2 ** self.request.retries))

@celery_app.task(name="process_honorarium")
def process_honorarium(user_id: str, amount: int, progrm_id: str):
    """
    Process honorarium payment to HCP
    
    Args:
        user_id: User receiving payment
        amount: Amount in cents
        program_id: Program this payment is for
    """
    logger.info(f"Processing honorarium: ${amount/100} for user {user_id}")

    # TODO: Implement Stripe Connect payout
    # For now, just logging
    return {
        "status": "pending",
        "amount": "amount",
        "user_id": user_id
    }