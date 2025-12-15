# Worker SQS Integration

Python worker service for processing background jobs from AWS SQS.

## Overview

The worker service consumes messages from 3 SQS queues and processes jobs asynchronously. It replaces the previous Celery/Redis architecture with a simpler boto3-based SQS consumer.

## Architecture
```
SQS Queues → SQS Consumers (3 threads) → Job Handlers → External Services
                                                ↓
                                          Database, S3, Stripe, SendGrid
```

## Changes Made

### 1. Removed Celery Dependencies

**Before:**
- celery
- redis
- Complex Celery protocol

**After:**
- boto3 (AWS SDK)
- Simple JSON messages
- Direct SQS integration

### 2. Created SQS Consumer

**Location:** `worker/app/sqs_consumer.py`

**Features:**
- Long polling (20 seconds)
- Batch processing (up to 10 messages)
- Automatic retries (via SQS visibility timeout)
- Dead Letter Queue integration
- Graceful error handling

### 3. Updated Worker Application

**Location:** `worker/app/worker.py`

**Features:**
- Multi-threaded (3 consumers, 1 per queue)
- Graceful shutdown (SIGTERM, SIGINT)
- Configurable via environment variables
- Comprehensive logging

### 4. Job Handlers

**Email Jobs** (`app/jobs/email_jobs.py`):
- `send_welcome_email(userEmail, userName)`
- `send_enrollment_confirmation(userEmail, programTitle)`
- `send_cme_certificate_email(userEmail, certificateUrl)`

**Payment Jobs** (`app/jobs/payment_jobs.py`):
- `process_payment(paymentId, amount, userId)`
- `process_honorarium(userId, amount, programId)`

**CME Jobs** (`app/jobs/cme_jobs.py`):
- `generate_cme_certificate(userId, programId, credits)`

## Dependencies
```txt
boto3==1.34.19          # AWS SDK
botocore==1.34.19
sqlalchemy==2.0.23      # Database ORM
psycopg2-binary==2.9.9  # PostgreSQL driver
stripe==7.8.0           # Payments
sendgrid==6.11.0        # Emails
reportlab==4.0.7        # PDF generation
pydantic-settings==2.1.0 # Configuration
httpx==0.25.2           # HTTP client
```

## Environment Variables
```bash
# Environment
ENVIRONMENT=development
AWS_REGION=us-east-1

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cht_platform

# SQS Queue URLs (from Terraform outputs)
SQS_EMAIL_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/cht-platform-email-queue-prod
SQS_PAYMENT_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/cht-platform-payment-queue-prod
SQS_CME_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/cht-platform-cme-queue-prod

# External Services
STRIPE_SECRET_KEY=sk_live_...
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@chtplatform.com

# S3
S3_BUCKET_CERTIFICATES=cht-platform-certificates-prod
```

## Running the Worker

### Development (Local)
```bash
cd worker

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run worker
python app/worker.py
```

### Production (ECS)

Worker runs as ECS Fargate task:
- IAM role for SQS receive permissions
- IAM role for S3 upload permissions
- Environment variables from Secrets Manager
- CloudWatch Logs for monitoring

## Message Format

### Message from Backend
```json
{
  "jobType": "send_welcome_email",
  "payload": {
    "userEmail": "user@example.com",
    "userName": "John Doe"
  },
  "metadata": {
    "userId": "clx123abc",
    "timestamp": "2024-12-14T12:00:00.000Z",
    "source": "backend-api"
  }
}
```

### Processing Flow
```
1. SQS Consumer receives message
2. Parse JSON body
3. Extract jobType and payload
4. Look up handler function
5. Execute handler(**payload)
6. Handler returns result
7. Delete message from queue (success)
8. If error: Don't delete (auto-retry)
```

## Error Handling

### Retry Logic

1. **Message fails to process** → Stays in queue
2. **Visibility timeout expires** → Message becomes visible again
3. **Worker retries** → Up to `maxReceiveCount` times
4. **Max retries exceeded** → Message moved to DLQ

### Dead Letter Queue (DLQ)

Failed messages go to DLQ after max retries:
- Email DLQ: 3 retries
- Payment DLQ: 5 retries
- CME DLQ: 3 retries

CloudWatch alarms trigger when messages appear in DLQ.

### Error Types

**Handled gracefully:**
- Missing handler (deletes message)
- Invalid payload (deletes message)
- Malformed JSON (deletes message)

**Auto-retry:**
- External service errors (Stripe, SendGrid)
- Database errors
- S3 upload errors
- Network errors

## Logging

### Log Levels
```python
DEBUG - Detailed processing info
INFO  - Normal operations
WARNING - Non-critical issues
ERROR - Failed operations
```

### Example Logs
```
2024-12-14 12:00:00,000 - app.sqs_consumer - INFO - SQS Consumer initialized for queue: https://sqs...
2024-12-14 12:00:01,000 - app.sqs_consumer - INFO - Received 5 messages
2024-12-14 12:00:01,100 - app.sqs_consumer - INFO - Processing job: send_welcome_email
2024-12-14 12:00:01,200 - app.jobs.email_jobs - INFO - Sending welcome email to user@example.com
2024-12-14 12:00:01,300 - app.sqs_consumer - INFO - Job completed: send_welcome_email - Result: {'status': 'success'}
2024-12-14 12:00:01,400 - app.sqs_consumer - DEBUG - Message deleted from queue
```

## Testing

### Local Testing (No SQS)

1. **Leave queue URLs empty:**
```bash
   SQS_EMAIL_QUEUE_URL=
```

2. **Start worker:**
```bash
   python app/worker.py
```

3. **Expected output:**
```
   WARNING - Email queue URL not configured
   ERROR - No queue URLs configured!
```

Worker runs but doesn't process jobs.

### Testing with LocalStack
```bash
# Install LocalStack
pip install localstack

# Start LocalStack
localstack start

# Create queues
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name email-queue
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name payment-queue
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name cme-queue

# Update .env
SQS_EMAIL_QUEUE_URL=http://localhost:4566/000000000000/email-queue
SQS_PAYMENT_QUEUE_URL=http://localhost:4566/000000000000/payment-queue
SQS_CME_QUEUE_URL=http://localhost:4566/000000000000/cme-queue

# Start worker
python app/worker.py
```

### Testing with Real SQS

After deploying infrastructure:
```bash
# Get queue URLs from Terraform
cd infrastructure/terraform
terraform output -json | jq '.all_queue_urls.value'

# Update worker .env with real URLs

# Start worker
cd worker
python app/worker.py

# In another terminal, trigger job from backend
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","firstName":"Test","lastName":"User","authId":"auth0|123"}'

# Check worker logs - should process welcome email
```

## Job Handler Examples

### Email Job
```python
def send_welcome_email(userEmail: str, userName: str):
    """Send welcome email"""
    logger.info(f"Sending welcome email to {userEmail}")
    
    # SendGrid integration
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail
    
    message = Mail(
        from_email=settings.SENDGRID_FROM_EMAIL,
        to_emails=userEmail,
        subject='Welcome to CHT Platform!',
        html_content=f'<p>Hello {userName},</p><p>Welcome!</p>'
    )
    
    sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
    response = sg.send(message)
    
    return {
        "status": "success",
        "email": userEmail,
        "sendgrid_status": response.status_code
    }
```

### CME Certificate Job
```python
def generate_cme_certificate(userId: str, programId: str, credits: float):
    """Generate CME certificate PDF"""
    logger.info(f"Generating certificate for user {userId}")
    
    # 1. Get user and program data from database
    from app.database import SessionLocal
    db = SessionLocal()
    user = db.query(User).filter(User.id == userId).first()
    program = db.query(Program).filter(Program.id == programId).first()
    
    # 2. Generate PDF with ReportLab
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    
    filename = f"certificate_{userId}_{programId}.pdf"
    c = canvas.Canvas(filename, pagesize=letter)
    c.drawString(100, 750, f"CME Certificate")
    c.drawString(100, 700, f"Awarded to: {user.firstName} {user.lastName}")
    c.drawString(100, 650, f"Program: {program.title}")
    c.drawString(100, 600, f"Credits: {credits}")
    c.save()
    
    # 3. Upload to S3
    import boto3
    s3 = boto3.client('s3')
    s3.upload_file(
        filename,
        settings.S3_BUCKET_CERTIFICATES,
        f"certificates/{userId}/{filename}"
    )
    
    # 4. Generate signed URL
    url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': settings.S3_BUCKET_CERTIFICATES, 'Key': f"certificates/{userId}/{filename}"},
        ExpiresIn=86400  # 24 hours
    )
    
    # 5. Queue email with certificate
    from app.jobs.email_jobs import send_cme_certificate_email
    send_cme_certificate_email(user.email, url)
    
    return {
        "status": "success",
        "userId": userId,
        "certificateUrl": url
    }
```

## Migration from Celery

### Before (Celery)
```python
# app/celery_app.py
from celery import Celery

celery_app = Celery('worker')
celery_app.conf.broker_url = 'redis://localhost:6379/0'

@celery_app.task(name="send_welcome_email")
def send_welcome_email(userEmail, userName):
    # ...
```

**Start:**
```bash
celery -A app.celery_app worker --loglevel=info
```

### After (SQS)
```python
# app/jobs/email_jobs.py
def send_welcome_email(userEmail: str, userName: str):
    # Same implementation
    pass

# app/worker.py
EMAIL_HANDLERS = {
    'send_welcome_email': email_jobs.send_welcome_email,
}
```

**Start:**
```bash
python app/worker.py
```

### Benefits

| Aspect | Celery | SQS |
|--------|--------|-----|
| **Setup** | Complex (broker, workers, beat) | Simple (just Python script) |
| **Message format** | Celery protocol | JSON |
| **Retries** | Manual configuration | Built-in DLQ |
| **Monitoring** | Flower + custom | CloudWatch |
| **Infrastructure** | Redis required | AWS managed |
| **Cost** | $12-24/month | FREE (free tier) |
| **Scaling** | Manual | Auto-scaling |

## Troubleshooting

### Worker won't start

**Check Python version:**
```bash
python --version  # Should be 3.9+
```

**Check dependencies:**
```bash
pip list | grep boto3
```

**Check PYTHONPATH:**
```bash
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

### No messages being processed

**Check queue URLs configured:**
```bash
echo $SQS_EMAIL_QUEUE_URL
```

**Check IAM permissions:**
- Worker needs `sqs:ReceiveMessage`
- Worker needs `sqs:DeleteMessage`
- Worker needs `kms:Decrypt` (for encrypted queues)

**Check CloudWatch Logs:**
```bash
aws logs tail /aws/ecs/cht-platform/prod/worker --follow
```

### Messages going to DLQ

**Check DLQ messages:**
```bash
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789/cht-platform-email-dlq-prod \
  --max-number-of-messages 10
```

**Common causes:**
- Invalid payload (wrong parameter names)
- Missing external service credentials
- Database connection errors
- S3 permission errors

## Performance

### Current Configuration

- **3 consumers** (1 per queue)
- **10 messages per batch**
- **20 second long polling**
- **Max 30 messages/minute per queue**

### Scaling

**Vertical (single worker):**
- Increase MaxNumberOfMessages (up to 10)
- Reduce WaitTimeSeconds (min 0)
- Add more threads per queue

**Horizontal (multiple workers):**
- Deploy multiple ECS tasks
- Each pulls from same queues
- SQS handles deduplication

## Next Steps

1. ✅ Worker integrated with SQS
2. ⏳ Deploy infrastructure (Terraform)
3. ⏳ Implement SendGrid integration
4. ⏳ Implement Stripe integration
5. ⏳ Implement CME certificate generation
6. ⏳ End-to-end testing

## Related Documentation

- [Backend SQS Integration](./BACKEND_SQS_INTEGRATION.md)
- [SQS Module](./SQS_MODULE.md)
- [KMS Module](./KMS_MODULE.md)
