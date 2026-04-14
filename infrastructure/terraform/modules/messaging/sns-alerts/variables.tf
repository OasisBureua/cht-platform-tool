variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "kms_key_id" {
  description = "KMS key ID for SNS encryption"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID for SNS policy"
  type        = string
}

variable "alarm_notification_emails" {
  description = "Email addresses to receive alarm notifications (must confirm subscription)"
  type        = list(string)
  default     = []
}
