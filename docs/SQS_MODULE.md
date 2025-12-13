# SQS Module

AWS SQS queues for background job processing.

## Structure
```
modules/sqs/
├── main.tf       # 3 queues + 3 DLQs + IAM policies + alarms
├── variables.tf  # Module inputs
└── outputs.tf    # Module outputs
```

## Queues Created

| Queue | Purpose | Timeout | Retries | DLQ |
|-------|---------|---------|---------|-----|
| **email** | Email jobs | 5 min | 3 | ✅ |
| **payment** | Payment processing | 10 min | 5 | ✅ |
| **cme** | Certificate generation | 15 min | 3 | ✅ |

## Usage
```hcl
module "sqs" {
  source = "./modules/sqs"

  project_name = "cht-platform"
  environment  = "prod"

  # KMS key from KMS module
  sqs_kms_key_id  = module.kms.sqs_kms_key_id
  sqs_kms_key_arn = module.kms.sqs_kms_key_arn

  common_tags = {
    Project     = "CHT Platform"
    Environment = "prod"
  }
}
```

## Outputs
```hcl
# Queue URLs
module.sqs.email_queue_url
module.sqs.payment_queue_url
module.sqs.cme_queue_url

# All URLs (map)
module.sqs.all_queue_urls

# IAM policies
module.sqs.backend_sqs_policy_arn
module.sqs.worker_sqs_policy_arn
```

## Features

- ✅ KMS encryption at rest
- ✅ Long polling (20 seconds)
- ✅ Dead Letter Queues
- ✅ CloudWatch alarms for DLQs
- ✅ IAM policies for backend/worker
- ✅ Message retention (4 days)

## Cost

**FREE** (within free tier: 1M requests/month)

## Security

- ✅ Encrypted with KMS
- ✅ IAM-based access control
- ✅ VPC endpoints (optional)
- ✅ CloudTrail logging
