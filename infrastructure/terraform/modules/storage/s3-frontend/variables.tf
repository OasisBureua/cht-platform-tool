variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
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