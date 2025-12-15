# Backend SQS Integration

Backend integration with AWS SQS for job queuing.

## Changes Made

### 1. New Service: SqsService

**Location:** `backend/src/queue/sqs.service.ts`

**Features:**
- Send messages to SQS queues
- Email job helpers
- Payment job helpers
- CME job helpers
- Queue status checking

### 2. Updated Services

**UsersService:**
- Uses `SqsService` instead of old queue service
- Queues welcome email on user creation
- Non-blocking (doesn't fail user creation if queue fails)

**ProgramsService:**
- Uses `SqsService` for enrollment emails
- Queues enrollment confirmation
- Non-blocking error handling

### 3. Dependencies
```json
{
  "@aws-sdk/client-sqs": "^3.x.x"
}
```

### 4. Environment Variables
```bash
# AWS
AWS_REGION=us-east-1

# SQS Queues
SQS_EMAIL_QUEUE_URL=https://sqs...
SQS_PAYMENT_QUEUE_URL=https://sqs...
SQS_CME_QUEUE_URL=https://sqs...

# KMS (for PII encryption)
KMS_PII_KEY_ID=arn:aws:kms:...
```

## Usage

### Sending Email Jobs
```typescript
// In any service
constructor(private sqsService: SqsService) {}

// Send welcome email
await this.sqsService.sendWelcomeEmail(
  'user@example.com',
  'John Doe'
);

// Send enrollment confirmation
await this.sqsService.sendEnrollmentConfirmation(
  'user@example.com',
  'Program Title'
);
```

### Sending Payment Jobs
```typescript
// Process payment
await this.sqsService.processPayment(
  'payment_123',
  5000, // amount in cents
  'user_id'
);
```

### Sending CME Jobs
```typescript
// Generate certificate
await this.sqsService.generateCMECertificate(
  'user_id',
  'program_id',
  2.5 // credits
);
```

## Health Check
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-13T...",
  "services": {
    "api": "healthy",
    "database": "healthy",
    "queues": {
      "configured": false,
      "status": {
        "email": false,
        "payment": false,
        "cme": false
      }
    }
  }
}
```

## Error Handling

All queue operations are non-blocking:
- User creation succeeds even if email fails to queue
- Enrollment succeeds even if confirmation email fails
- Errors are logged but don't propagate

## Testing Locally

### Without SQS (Development)

Leave queue URLs empty in `.env`:
```bash
SQS_EMAIL_QUEUE_URL=
```

Jobs will fail to queue but won't break the API.

### With LocalStack (SQS Emulator)
```bash
# Install LocalStack
pip install localstack

# Start LocalStack with SQS
localstack start

# Update .env
SQS_EMAIL_QUEUE_URL=http://localhost:4566/000000000000/email-queue
```

### With Real SQS

Deploy infrastructure with Terraform, get queue URLs from outputs.

## Migration from Redis Queue

### Before (Redis/Celery)
```typescript
await this.queueService.queueTask(
  'send_welcome_email',
  [email, name],
  {}
);
```

### After (SQS)
```typescript
await this.sqsService.sendWelcomeEmail(email, name);
```

## Benefits Over Redis

✅ Fully managed (no infrastructure)  
✅ Encrypted at rest (KMS)  
✅ Built-in DLQ  
✅ IAM-based access control  
✅ Free tier (1M requests/month)  
✅ Auto-scaling  
✅ Message persistence (4 days)

## Next Steps

1. ✅ Backend integrated with SQS
2. ⏳ Worker integration (Phase 3)
3. ⏳ Deploy infrastructure
4. ⏳ End-to-end testing
