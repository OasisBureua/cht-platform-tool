variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "kms_key_id" {
  description = "KMS key ID for queue encryption"
  type        = string
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for DLQ alarm notifications"
  type        = string
  default     = ""
}