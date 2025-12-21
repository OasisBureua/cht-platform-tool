# CHT Platform Worker Service

Background job processor for the CHT Platform using Python and AWS SQS.

## Overview

The worker service processes asynchronous jobs from SQS queues:

- **Email Consumer**: Sends emails via SendGrid
- **Payment Consumer**: Processes payments via Stripe
- **CME Consumer**: Generates PDF certificates and uploads to S3

## Architecture
```
Backend (NestJS) → SQS Queues → Worker (Python) → External Services
                                      ↓
                                  Database
```

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL (running)
- AWS credentials (for production)

### Installation
```bash
cd worker

# Install dependencies
pip install -r requirements.txt --break-system-packages

# Or use virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env
```

**Required:**
- `DATABASE_URL` - PostgreSQL connection string

**Optional (for full functionality):**
- `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `SQS_*_QUEUE_URL` - SQS queue URLs
- `SENDGRID_API_KEY` - SendGrid for emails
- `STRIPE_SECRET_KEY` - Stripe for payments
- `S3_CERTIFICATES_BUCKET` - S3 bucket for certificates

## Running

### Start All Workers
```bash
python start_workers.py
```

### Run Individual Consumer
```bash
# Email consumer only
python consumers/email_consumer.py

# Payment consumer only
python consumers/payment_consumer.py

# CME consumer only
python consumers/cme_consumer.py
```

## Mock Mode

Workers run in **mock mode** when external services aren't configured:

- **No SQS**: Workers idle (log messages only)
- **No SendGrid**: Emails logged to console
- **No Stripe**: Payments recorded in database (no actual transfer)
- **No S3**: Certificate URLs mocked

This allows local development without AWS/external services!

## Testing

### Test Database Connection
```python
from services.database import test_connection
test_connection()
```

### Test Email Service
```python
from services.email_service import EmailService

email = EmailService()
email.send_email(
    'test@example.com',
    'Test Subject',
    '<h1>Test Email</h1>'
)
```

### Trigger Jobs from Backend
```bash
# Complete a program to trigger all 3 workers:
# - Email: Completion notification
# - Payment: Honorarium payment
# - CME: Certificate generation
```

## Production Deployment

### Docker
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
CMD ["python", "start_workers.py"]
```

### ECS Task Definition

See `infrastructure/terraform/worker/` for deployment configuration.

## Monitoring

Logs are output in JSON format for easy parsing:
```json
{
  "asctime": "2024-12-21 10:30:00",
  "name": "email_consumer",
  "levelname": "INFO",
  "message": "Email sent to user@example.com"
}
```

## Queue Message Formats

### Email Queue
```json
{
  "type": "SEND_EMAIL",
  "to": "user@example.com",
  "subject": "Welcome!",
  "body": "<html>...</html>",
  "timestamp": "2024-12-21T10:30:00Z"
}
```

### Payment Queue
```json
{
  "type": "PROCESS_PAYMENT",
  "userId": "user123",
  "amount": 50000,
  "paymentType": "HONORARIUM",
  "programId": "program123",
  "timestamp": "2024-12-21T10:30:00Z"
}
```

### CME Queue
```json
{
  "type": "GENERATE_CERTIFICATE",
  "userId": "user123",
  "programId": "program123",
  "credits": 2.5,
  "timestamp": "2024-12-21T10:30:00Z"
}
```

## Troubleshooting

### Database Connection Failed

- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Test: `psql $DATABASE_URL`

### Workers Not Processing

- Check SQS queue URLs configured
- Verify AWS credentials
- Check queue has messages

### Emails Not Sending

- Verify `SENDGRID_API_KEY` set
- Check SendGrid dashboard for errors
- Verify sender email is verified

## License

Proprietary - CHT Platform
