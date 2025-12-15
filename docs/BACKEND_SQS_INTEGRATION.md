# Backend SQS Integration

Backend integration with AWS SQS for job queuing.

## Overview

The backend now uses AWS SQS instead of Redis for job queuing. This provides better security, reliability, and cost-effectiveness.

## Changes Made

### 1. New Service: SqsService

**Location:** `backend/src/queue/sqs.service.ts`

**Responsibilities:**
- Send messages to SQS queues (email, payment, cme)
- Type-safe job helpers for each queue
- Queue configuration validation
- Error handling and logging

**Methods:**
```typescript
// Email jobs
sendWelcomeEmail(userEmail: string, userName: string): Promise<string>
sendEnrollmentConfirmation(userEmail: string, programTitle: string): Promise<string>
sendCMECertificateEmail(userEmail: string, certificateUrl: string): Promise<string>

// Payment jobs
processPayment(paymentId: string, amount: number, userId: string): Promise<string>
processHonorarium(userId: string, amount: number, programId: string): Promise<string>

// CME jobs
generateCMECertificate(userId: string, programId: string, credits: number): Promise<string>

// Utility
isConfigured(): boolean
getQueueStatus(): Record<string, boolean>
```

### 2. Updated Services

**UsersService** (`src/modules/users/users.service.ts`):
- Replaced old queue service with SqsService
- Queues welcome email on user creation
- Non-blocking: doesn't fail if email queuing fails
- Error logged but user creation succeeds

**ProgramsService** (`src/modules/programs/programs.service.ts`):
- Uses SqsService for enrollment emails
- Queues enrollment confirmation on program enrollment
- Non-blocking error handling
- Maintains program enrollment even if email fails

**ProgramsController** (`src/modules/programs/programs.controller.ts`):
- Fixed method names to match service
- `getMyEnrollments()` - Get current user's enrollments
- `getProgramEnrollments()` - Get all enrollments for a program (Admin only)

### 3. Updated Modules

**QueueModule** (`src/queue/queue.module.ts`):
- Now provides SqsService instead of old queue service
- Global module (available everywhere)
- Imports ConfigModule for environment variables

**AppModule** (`src/app.module.ts`):
- Imports QueueModule globally
- QueueModule available to all feature modules

**AppController** (`src/app.controller.ts`):
- Added health check endpoint
- Shows queue configuration status
- Returns service health information

### 4. Dependencies Added
```json
{
  "@aws-sdk/client-sqs": "^3.x.x"
}
```

Installed with:
```bash
npm install @aws-sdk/client-sqs
```

### 5. Environment Variables

**Required:**
```bash
# AWS Region
AWS_REGION=us-east-1

# SQS Queue URLs (from Terraform outputs after deployment)
SQS_EMAIL_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/cht-platform-email-queue-prod
SQS_PAYMENT_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/cht-platform-payment-queue-prod
SQS_CME_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/cht-platform-cme-queue-prod
```

**Optional (for PII encryption - Phase 4):**
```bash
KMS_PII_KEY_ID=arn:aws:kms:us-east-1:123456789:key/12345678-1234-1234-1234-123456789012
```

## Usage Examples

### In UsersService
```typescript
import { SqsService } from '../../queue/sqs.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private sqsService: SqsService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const user = await this.prisma.user.create({
      data: createUserDto,
    });

    // Queue welcome email (non-blocking)
    this.sqsService
      .sendWelcomeEmail(user.email, `${user.firstName} ${user.lastName}`)
      .catch((error) => {
        console.error('Failed to queue welcome email:', error);
        // User creation still succeeds
      });

    return user;
  }
}
```

### In ProgramsService
```typescript
import { SqsService } from '../../queue/sqs.service';

@Injectable()
export class ProgramsService {
  constructor(
    private prisma: PrismaService,
    private sqsService: SqsService,
  ) {}

  async enroll(programId: string, userId: string) {
    const enrollment = await this.prisma.programEnrollment.create({
      data: { userId, programId },
      include: { program: true, user: true },
    });

    // Queue enrollment email (non-blocking)
    this.sqsService
      .sendEnrollmentConfirmation(
        enrollment.user.email,
        enrollment.program.title,
      )
      .catch((error) => {
        console.error('Failed to queue enrollment email:', error);
        // Enrollment still succeeds
      });

    return enrollment;
  }
}
```

## API Endpoints

### Health Check

**GET /health**

Returns system health status including queue configuration.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-14T12:00:00.000Z",
  "services": {
    "api": "healthy",
    "database": "healthy",
    "queues": {
      "configured": true,
      "status": {
        "email": true,
        "payment": true,
        "cme": true
      }
    }
  }
}
```

When queues are not configured (development):
```json
{
  "status": "ok",
  "timestamp": "2024-12-14T12:00:00.000Z",
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

### Non-Blocking Pattern

All queue operations use the non-blocking pattern:
```typescript
// ✅ CORRECT: Non-blocking
this.sqsService
  .sendWelcomeEmail(email, name)
  .catch((error) => {
    console.error('Failed to queue:', error);
    // Main operation still succeeds
  });

// ❌ WRONG: Blocking (would fail main operation)
await this.sqsService.sendWelcomeEmail(email, name);
```

### Error Types

1. **Queue not configured:** Throws error if queue URL is empty
2. **SQS send failure:** AWS SDK error (network, permissions, etc.)
3. **Invalid message:** JSON serialization error

All errors are logged but don't propagate to the main operation.

## Testing

### Local Development (No SQS)

1. **Leave queue URLs empty in `.env`:**
```bash
   SQS_EMAIL_QUEUE_URL=
   SQS_PAYMENT_QUEUE_URL=
   SQS_CME_QUEUE_URL=
```

2. **Start backend:**
```bash
   npm run start:dev
```

3. **API works normally, jobs fail to queue (logged but ignored)**

### With LocalStack (SQS Emulator)

1. **Install LocalStack:**
```bash
   pip install localstack
```

2. **Start LocalStack:**
```bash
   localstack start
```

3. **Create test queues:**
```bash
   aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name email-queue
   aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name payment-queue
   aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name cme-queue
```

4. **Update `.env`:**
```bash
   SQS_EMAIL_QUEUE_URL=http://localhost:4566/000000000000/email-queue
   SQS_PAYMENT_QUEUE_URL=http://localhost:4566/000000000000/payment-queue
   SQS_CME_QUEUE_URL=http://localhost:4566/000000000000/cme-queue
```

5. **Start backend and test**

### With Real AWS SQS

1. **Deploy infrastructure with Terraform** (Phase 5)
2. **Get queue URLs from Terraform outputs**
3. **Update `.env` with real queue URLs**
4. **Ensure ECS task has IAM permissions**

## Migration from Redis Queue

### Before (Redis/Celery)
```typescript
// Old approach
import { QueueService } from '../../queue/queue.service';

await this.queueService.queueTask(
  'send_welcome_email',
  [userEmail, userName],
  {}
);
```

### After (SQS)
```typescript
// New approach
import { SqsService } from '../../queue/sqs.service';

this.sqsService
  .sendWelcomeEmail(userEmail, userName)
  .catch((error) => console.error('Queue error:', error));
```

### Key Differences

| Aspect | Redis/Celery | SQS |
|--------|--------------|-----|
| **Message format** | Celery protocol (complex) | JSON (simple) |
| **Configuration** | Redis connection + Celery setup | Just queue URLs |
| **Type safety** | Generic task function | Dedicated methods |
| **Error handling** | Manual retry logic | Built-in DLQ |
| **Infrastructure** | Self-managed Redis | Fully managed AWS |
| **Cost** | $12-24/month | FREE (free tier) |

## Benefits of SQS

### Security
✅ KMS encryption at rest  
✅ HTTPS encryption in transit  
✅ IAM-based access control  
✅ No exposed ports or Redis auth tokens  

### Reliability
✅ 99.9% SLA  
✅ Multi-AZ replication  
✅ Message persistence (4 days)  
✅ Built-in Dead Letter Queue  
✅ Automatic retries  

### Cost
✅ Free tier: 1M requests/month  
✅ After free tier: $0.40 per million  
✅ No infrastructure costs  
✅ Saves $12-24/month vs Redis  

### Scalability
✅ Unlimited throughput  
✅ Auto-scaling  
✅ No capacity planning  
✅ Pay per use  

### Operations
✅ Fully managed (no patches, no backups)  
✅ CloudWatch integration  
✅ CloudTrail audit logging  
✅ VPC endpoints support  

## Troubleshooting

### Queue URLs not configured

**Symptom:** Health check shows `configured: false`

**Solution:**
```bash
# Check .env file
cat backend/.env | grep SQS

# Ensure URLs are set
SQS_EMAIL_QUEUE_URL=https://sqs...
```

### Permission denied errors

**Symptom:** `AccessDenied` error when sending messages

**Solution:**
- Verify ECS task role has SQS send permissions
- Check IAM policy attached to backend task role
- Verify KMS key permissions for encryption

### Messages not being received by worker

**Symptom:** Messages sent but worker doesn't process

**Solution:**
- Verify worker is running and polling correct queue URL
- Check worker has SQS receive permissions
- Check CloudWatch Logs for worker errors
- Verify message format matches worker expectations

## Next Steps

1. ✅ Backend integrated with SQS
2. ⏳ **Worker service integration** (Phase 3)
3. ⏳ Infrastructure deployment (Terraform)
4. ⏳ End-to-end testing
5. ⏳ Production deployment

## Related Documentation

- [SQS Module Documentation](./SQS_MODULE.md)
- [KMS Module Documentation](./KMS_MODULE.md)
- [Infrastructure Modules](./INFRASTRUCTURE_MODULES.md)
- [Worker Integration](./WORKER_SQS_INTEGRATION.md) (Phase 3)
