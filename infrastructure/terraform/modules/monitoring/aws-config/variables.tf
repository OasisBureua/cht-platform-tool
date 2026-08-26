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
  description = "KMS key ARN for Config S3 bucket encryption"
  type        = string
}
