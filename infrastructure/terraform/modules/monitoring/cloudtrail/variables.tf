variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}

variable "s3_kms_key_arn" {
  description = "KMS key ARN for S3 encryption"
  type        = string
}

variable "cloudwatch_kms_key_arn" {
  description = "KMS key ARN for CloudWatch Logs encryption"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention for CloudTrail delivery"
  type        = number
  default     = 365
}
