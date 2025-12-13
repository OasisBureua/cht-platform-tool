variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment (dev, test, prod)"
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "sqs_kms_key_id" {
  description = "KMS key ID for SQS encryption (from KMS module)"
  type        = string
}

variable "sqs_kms_key_arn" {
  description = "KMS key ARN for SQS encryption (from KMS module)"
  type        = string
}