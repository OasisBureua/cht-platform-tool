# KMS Module

Comprehensive KMS encryption for CHT Platform.

## Structure
```
modules/kms/
├── main.tf       # All 6 KMS keys + policies + grants
├── variables.tf  # Module inputs
└── outputs.tf    # Module outputs
```

## Keys Created

| Key | Purpose | Rotation | Used By |
|-----|---------|----------|---------|
| **rds** | RDS encryption | ✅ | RDS Aurora |
| **s3** | S3 encryption | ✅ | S3 buckets, CloudFront |
| **sqs** | SQS encryption | ✅ | SQS queues |
| **pii** | PII field encryption | ✅ | Backend, Worker |
| **secrets** | Secrets encryption | ✅ | Secrets Manager |
| **cloudwatch** | Logs encryption | ✅ | CloudWatch Logs |

## Usage
```hcl
module "kms" {
  source = "./modules/kms"

  project_name = "cht-platform"
  environment  = "prod"

  # Optional: IAM role ARNs for grants
  backend_task_role_arn = aws_iam_role.backend_task.arn
  worker_task_role_arn  = aws_iam_role.worker_task.arn
  ecs_task_role_arn     = aws_iam_role.ecs_task.arn

  common_tags = {
    Project     = "CHT Platform"
    Environment = "prod"
  }
}
```

## Outputs
```hcl
# Individual keys
module.kms.rds_kms_key_id
module.kms.s3_kms_key_arn
module.kms.sqs_kms_key_id
module.kms.pii_kms_key_arn

# All keys (map)
module.kms.all_kms_key_ids
module.kms.all_kms_key_arns
```

## Security Features

- ✅ Auto-rotation enabled (annual)
- ✅ 30-day deletion window
- ✅ Service-specific key policies
- ✅ IAM grants for ECS tasks
- ✅ PII key deletion protection
- ✅ CloudTrail integration

## Cost

**~$6/month** (6 keys × $1/key)

## Compliance

- ✅ HIPAA compliant
- ✅ Encryption at rest
- ✅ Key rotation
- ✅ Audit logging
