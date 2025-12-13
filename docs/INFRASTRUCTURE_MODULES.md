# CHT Platform Infrastructure Modules

Complete Terraform module reference.

## Module Overview
```
infrastructure/terraform/modules/
├── kms/           # Encryption keys (6 keys)
└── sqs/           # Job queues (3 queues)
```

## Quick Start
```hcl
# Main Terraform configuration
terraform {
  required_version = ">= 1.5.0"
}

# KMS Module
module "kms" {
  source = "./modules/kms"

  project_name = var.project_name
  environment  = var.environment
  common_tags  = var.common_tags
}

# SQS Module
module "sqs" {
  source = "./modules/sqs"

  project_name    = var.project_name
  environment     = var.environment
  sqs_kms_key_id  = module.kms.sqs_kms_key_id
  sqs_kms_key_arn = module.kms.sqs_kms_key_arn
  common_tags     = var.common_tags
}
```

## Module Dependencies
```
KMS Module (independent)
  ↓
SQS Module (requires KMS)
```

## Environment Variables

Backend and Worker need these from Terraform outputs:
```bash
# Backend .env
AWS_REGION=us-east-1
KMS_PII_KEY_ID=<from module.kms.pii_kms_key_id>
SQS_EMAIL_QUEUE_URL=<from module.sqs.email_queue_url>
SQS_PAYMENT_QUEUE_URL=<from module.sqs.payment_queue_url>
SQS_CME_QUEUE_URL=<from module.sqs.cme_queue_url>

# Worker .env
AWS_REGION=us-east-1
SQS_EMAIL_QUEUE_URL=<from module.sqs.email_queue_url>
SQS_PAYMENT_QUEUE_URL=<from module.sqs.payment_queue_url>
SQS_CME_QUEUE_URL=<from module.sqs.cme_queue_url>
```

## Cost Summary

| Module | Monthly Cost | Items |
|--------|--------------|-------|
| KMS | $6.00 | 6 keys |
| SQS | $0.00 | 3 queues (free tier) |
| **Total** | **$6.00** | |

## Deployment
```bash
cd infrastructure/terraform

# Initialize
terraform init

# Plan
terraform plan -var-file="variables/prod.tfvars"

# Apply
terraform apply -var-file="variables/prod.tfvars"

# Get outputs
terraform output -json > outputs.json
```

## Module Details

See individual documentation:
- [KMS Module](./KMS_MODULE.md)
- [SQS Module](./SQS_MODULE.md)

## Security

- ✅ All encryption keys managed by KMS
- ✅ IAM policies follow least privilege
- ✅ CloudTrail logging enabled
- ✅ Auto-rotation on keys
- ✅ DLQs for failed jobs
- ✅ CloudWatch alarms
