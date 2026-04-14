variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs"
  type        = list(string)
}

variable "cluster_id" {
  description = "ECS cluster ID"
  type        = string
}

variable "cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "execution_role_arn" {
  description = "ECS task execution role ARN"
  type        = string
}

variable "task_role_arn" {
  description = "Worker task role ARN"
  type        = string
}

variable "log_group_name" {
  description = "CloudWatch log group name"
  type        = string
}

variable "container_image" {
  description = "Docker container image"
  type        = string
}

variable "database_secret_arn" {
  description = "Database secret ARN"
  type        = string
}

variable "app_secrets_arn" {
  description = "Application secrets ARN"
  type        = string
}

variable "sqs_queue_urls_env_file_arn" {
  description = "S3 ARN for environment file with SQS queue URLs"
  type        = string
  default     = ""
}

variable "sqs_email_queue_url" {
  description = "SQS email queue URL"
  type        = string
  default     = ""
}

variable "sqs_payment_queue_url" {
  description = "SQS payment queue URL"
  type        = string
  default     = ""
}

variable "sqs_cme_queue_url" {
  description = "SQS CME queue URL"
  type        = string
  default     = ""
}

variable "security_group_ids" {
  description = "Security group IDs for worker tasks (optional - creates default if not provided)"
  type        = list(string)
  default     = []
}

variable "primary_queue_name" {
  description = "Primary SQS queue name for scaling"
  type        = string
}

variable "task_cpu" {
  description = "Task CPU units"
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Task memory (MB)"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 1
}

variable "min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 10
}


variable "enable_scheduled_scaling" {
  description = "Enabled scheduled ECS scaling (dev only)"
  type        = bool
  default     = false
}

variable "ses_from_email" {
  description = "From email address for SES (must be verified in SES)"
  type        = string
  default     = "noreply@chtplatform.com"
}