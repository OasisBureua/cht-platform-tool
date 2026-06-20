variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "role" {
  description = "primary (us-east-1 writer) or secondary (us-east-2 reader cluster)"
  type        = string

  validation {
    condition     = contains(["primary", "secondary"], var.role)
    error_message = "role must be primary or secondary"
  }
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the DB subnet group"
  type        = list(string)
}

variable "allowed_security_groups" {
  description = "Security groups allowed to connect on port 5432"
  type        = list(string)
}

variable "kms_key_arn" {
  description = "KMS key ARN for storage encryption"
  type        = string
}

variable "instance_class" {
  description = "Aurora instance class (e.g. db.t4g.medium)"
  type        = string
  default     = "db.r6g.large"
}

variable "engine_version" {
  description = "Aurora PostgreSQL engine version"
  type        = string
  default     = "15.17"
}

variable "database_name" {
  description = "Initial database name (primary only)"
  type        = string
  default     = "cht_platform"
}

variable "master_username" {
  description = "Master username (primary only)"
  type        = string
  default     = "cht_admin"
}

variable "backup_retention_period" {
  description = "Backup retention in days"
  type        = number
  default     = 7
}

variable "global_cluster_identifier" {
  description = "Global cluster ID (required for secondary role)"
  type        = string
  default     = ""
}

variable "deletion_protection" {
  description = "Enable deletion protection on clusters"
  type        = bool
  default     = true
}
