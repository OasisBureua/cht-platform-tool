variable "project_name" {
  description = "Project name (e.g., cht-platform)"
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

variable "backend_task_role_arn" {
  description = "Backend ECS task role ARN for PII encryption grants"
  type        = string
  default     = ""
}

variable "worker_task_role_arn" {
  description = "Worker ECS task role ARN for PII decryption grants"
  type        = string
  default     = ""
}

variable "ecs_task_role_arn" {
  description = "Generic ECS task role ARN for S3 access grants"
  type        = string
  default     = ""
}

variable "enable_key_rotation" {
  description = "Enable automatic key rotation for all KMS keys"
  type        = bool
  default     = true
}

variable "deletion_window_days" {
  description = "KMS key deletion window in days (7-30)"
  type        = number
  default     = 30

  validation {
    condition     = var.deletion_window_days >= 7 && var.deletion_window_days <= 30
    error_message = "Deletion window must be between 7 and 30 days."
  }
}