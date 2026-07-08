variable "project" {
  type        = string
  description = "Project name"
}

variable "environment" {
  type        = string
  description = "Environment name"
}

variable "aws_region" {
  type        = string
  description = "AWS region for bucket"
  default     = "us-east-1"
}

variable "cors_allowed_origins" {
  type        = list(string)
  description = "Origins allowed for browser PUT uploads (admin app URLs)"
}

variable "enable_replication" {
  description = "Enable S3 cross-region replication from this bucket."
  type        = bool
  default     = false
}

variable "replication_destination_bucket_arn" {
  description = "Destination bucket ARN for replication (required when enable_replication=true)."
  type        = string
  default     = ""
}

variable "replication_destination_account_id" {
  description = "Destination AWS account ID for replication access (optional for same-account)."
  type        = string
  default     = ""
}

variable "replication_destination_kms_key_arn" {
  description = "Destination KMS key ARN for replica encryption (optional)."
  type        = string
  default     = ""
}
