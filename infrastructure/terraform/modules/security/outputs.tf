# RDS Key
output "rds_kms_key_id" {
  description = "RDS KMS key ID"
  value       = aws_kms_key.rds.id
}

output "rds_kms_key_arn" {
  description = "RDS KMS key ARN"
  value       = aws_kms_key.rds.arn
}

# S3 Key
output "s3_kms_key_id" {
  description = "S3 KMS key ID"
  value       = aws_kms_key.s3.id
}

output "s3_kms_key_arn" {
  description = "S3 KMS key ARN"
  value       = aws_kms_key.s3.arn
}

# SQS Key
output "sqs_kms_key_id" {
  description = "SQS KMS key ID"
  value       = aws_kms_key.sqs.id
}

output "sqs_kms_key_arn" {
  description = "SQS KMS key ARN"
  value       = aws_kms_key.sqs.arn
}

# PII Key
output "pii_kms_key_id" {
  description = "PII KMS key ID"
  value       = aws_kms_key.pii.id
}

output "pii_kms_key_arn" {
  description = "PII KMS key ARN"
  value       = aws_kms_key.pii.arn
}

# Secrets Key
output "secrets_kms_key_id" {
  description = "Secrets Manager KMS key ID"
  value       = aws_kms_key.secrets.id
}

output "secrets_kms_key_arn" {
  description = "Secrets Manager KMS key ARN"
  value       = aws_kms_key.secrets.arn
}

# CloudWatch Key
output "cloudwatch_kms_key_id" {
  description = "CloudWatch Logs KMS key ID"
  value       = aws_kms_key.cloudwatch.id
}

output "cloudwatch_kms_key_arn" {
  description = "CloudWatch Logs KMS key ARN"
  value       = aws_kms_key.cloudwatch.arn
}

# All Keys (convenience)
output "all_kms_key_ids" {
  description = "Map of all KMS key IDs"
  value = {
    rds        = aws_kms_key.rds.id
    s3         = aws_kms_key.s3.id
    sqs        = aws_kms_key.sqs.id
    pii        = aws_kms_key.pii.id
    secrets    = aws_kms_key.secrets.id
    cloudwatch = aws_kms_key.cloudwatch.id
  }
}

output "all_kms_key_arns" {
  description = "Map of all KMS key ARNs"
  value = {
    rds        = aws_kms_key.rds.arn
    s3         = aws_kms_key.s3.arn
    sqs        = aws_kms_key.sqs.arn
    pii        = aws_kms_key.pii.arn
    secrets    = aws_kms_key.secrets.arn
    cloudwatch = aws_kms_key.cloudwatch.arn
  }
}