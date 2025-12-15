import logging

logger = logging.getLogger(__name__)


def process_payment(paymentId: str, amount: int, userId: str):
    """
    Process payment via Stripe
    
    Args:
        paymentId: Payment ID
        amount: Amount in cents
        userId: User ID
    
    Returns:
        dict: Job result
    """
    logger.info(f"Processing payment {paymentId} for ${amount/100:.2f}")
    
    # TODO: Implement Stripe integration
    logger.warning("Stripe not configured, skipping payment")
    
    return {
        "status": "success",
        "paymentId": paymentId,
        "amount": amount,
        "userId": userId
    }


def process_honorarium(userId: str, amount: int, programId: str):
    """
    Process honorarium payment to HCP
    
    Args:
        userId: User ID (HCP)
        amount: Amount in cents
        programId: Program ID
    
    Returns:
        dict: Job result
    """
    logger.info(f"Processing honorarium ${amount/100:.2f} for user {userId}")
    
    # TODO: Implement Stripe payout
    logger.warning("Stripe not configured, skipping honorarium")
    
    return {
        "status": "success",
        "userId": userId,
        "amount": amount,
        "programId": programId
    }
