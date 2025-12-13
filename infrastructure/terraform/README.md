# KMS Module

Comprehensive KMS encryption keys for the CHT Platform.

## Keys Created

1. **RDS Key** - Database encryption at rest
2. **S3 Key** - S3 bucket object encryption
3. **SQS Key** - SQS message encryption
4. **PII Key** - Application-level PII field encryption
5. **Secrets Key** - Secrets Manager encryption
6. **CloudWatch Key** - CloudWatch Logs encryption

## Features

- ✅ Auto-rotation enabled on all keys
- ✅ 30-day deletion window
- ✅ Proper key policies for each service
- ✅ IAM grants for ECS tasks
- ✅ HIPAA compliant
- ✅ CloudTrail integration

## Usage
```hcl
module "kms" {
  source = "./modules/kms"

  project_name = "cht-platform"
  environment  = "prod"

  backend_task_role_arn = aws_iam_role.backend_task.arn
  worker_task_role_arn  = aws_iam_role.worker_task.arn
  ecs_task_role_arn     = aws_iam_role.ecs_task.arn

  common_tags = {
    Project     = "CHT Platform"
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}
```

## Outputs

All keys provide:
- `<key>_kms_key_id` - Key ID
- `<key>_kms_key_arn` - Key ARN
- `<key>_kms_alias_name` - Alias name

## Security

- PII key has deny policy for deletion (except root)
- All keys have rotation enabled
- Proper service principals in key policies
- CloudTrail logs all key usage

## Cost

**Monthly Cost:** ~$6/month (6 keys × $1/key/month)

## Compliance

- ✅ HIPAA compliant
- ✅ Encryption at rest
- ✅ Key rotation
- ✅ Access logging
