variable "project" {
  description = "Primary project name used in us-east-1."
  type        = string
}

variable "environment" {
  description = "Environment name (platform/dev/staging)."
  type        = string
}

variable "domain_name" {
  description = "Primary platform domain (used for CORS and app URLs)."
  type        = string
}

variable "backend_image" {
  description = "Backend Docker image."
  type        = string
}

variable "worker_image" {
  description = "Worker Docker image."
  type        = string
}

variable "backend_task_cpu" {
  description = "Backend task CPU."
  type        = number
}

variable "backend_task_memory" {
  description = "Backend task memory (MB)."
  type        = number
}

variable "backend_desired_count" {
  description = "Primary-region desired backend task count."
  type        = number
}

variable "backend_min_capacity" {
  description = "Primary-region backend min capacity."
  type        = number
}

variable "backend_max_capacity" {
  description = "Primary-region backend max capacity."
  type        = number
}

variable "worker_task_cpu" {
  description = "Worker task CPU."
  type        = number
}

variable "worker_task_memory" {
  description = "Worker task memory (MB)."
  type        = number
}

variable "worker_desired_count" {
  description = "Primary-region desired worker task count."
  type        = number
}

variable "worker_min_capacity" {
  description = "Primary-region worker min capacity."
  type        = number
}

variable "worker_max_capacity" {
  description = "Primary-region worker max capacity."
  type        = number
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN in us-east-2 for DR ALB HTTPS listener."
  type        = string
}

variable "dr_acm_certificate_arn" {
  description = "Optional explicit ACM certificate ARN for us-east-2 ALB. If empty, acm_certificate_arn is used."
  type        = string
  default     = ""
}

variable "alarm_notification_emails" {
  description = "Alarm notification emails."
  type        = list(string)
  default     = []
}

variable "worker_ses_from_email" {
  description = "SES from email used by worker."
  type        = string
  default     = "noreply@chtplatform.com"
}

variable "session_reminders_schedule_expression" {
  description = "EventBridge schedule for reminder scans."
  type        = string
  default     = "cron(0 0/3 * * ? *)"
}

variable "dr_standby_scale_factor" {
  description = "Standby scale factor applied to desired/min/max capacities."
  type        = number
  default     = 0.5
}

variable "enable_db_replica" {
  description = "Create cross-region read replica in us-east-2."
  type        = bool
  default     = true
}

variable "dr_rds_instance_class" {
  description = "RDS instance class for DR read replica."
  type        = string
  default     = "db.t3.small"
}

variable "enable_aurora_global" {
  description = "Attach DR Aurora secondary cluster to primary Global Database."
  type        = bool
  default     = false
}

variable "aurora_instance_class" {
  description = "Aurora instance class for Global Database secondary cluster."
  type        = string
  default     = "db.r6g.large"
}

variable "aurora_engine_version" {
  description = "Aurora PostgreSQL engine version (fallback if primary state output missing)."
  type        = string
  default     = "15.17"
}

variable "decommission_rds" {
  description = "Remove RDS read replica after Aurora cutover."
  type        = bool
  default     = false
}

variable "aurora_use_for_app" {
  description = "Point DR database secret at Aurora reader endpoint."
  type        = bool
  default     = false
}

variable "rds_engine_version" {
  description = "RDS engine version for parameter group family compatibility."
  type        = string
  default     = "15.17"
}

variable "primary_db_instance_identifier" {
  description = "Primary us-east-1 DB instance identifier. Empty uses derived name."
  type        = string
  default     = ""
}

variable "cognito_user_pool_id" {
  description = "Primary Cognito user pool ID. Leave empty to import from us-east-1 Terraform state."
  type        = string
  default     = ""
}

variable "cognito_client_id" {
  description = "Cognito app client ID (cht-web). Leave empty to import from us-east-1 Terraform state."
  type        = string
  default     = ""
}

variable "cognito_hosted_ui_base_url" {
  description = "Cognito Hosted UI base URL. Leave empty to import from us-east-1 Terraform state."
  type        = string
  default     = ""
}

variable "cognito_jwks_uri" {
  description = "Cognito JWKS URI. Leave empty to import from us-east-1 Terraform state."
  type        = string
  default     = ""
}

