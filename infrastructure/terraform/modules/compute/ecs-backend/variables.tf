variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "resource_prefix" {
  description = "Prefix for resource names (optional - derived from project/environment if empty)"
  type        = string
  default     = ""
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
  description = "ECS task role ARN"
  type        = string
}

variable "alb_security_group_id" {
  description = "ALB security group ID"
  type        = string
}

variable "target_group_arn" {
  description = "ALB target group ARN"
  type        = string
}

variable "alb_listener_arn" {
  description = "ALB listener ARN"
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

variable "redis_secret_arn" {
  description = "Redis secret ARN"
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

variable "frontend_url" {
  description = "Frontend URL for CORS and redirects (e.g. https://testapp.communityhealth.media)"
  type        = string
  default     = ""
}

variable "sqs_email_queue_url" {
  description = "SQS email queue URL"
  type        = string
  default     = "https://sqs.us-east-1.amazonaws.com/233636046512/cht-platform-email-queue"
}

variable "sqs_payment_queue_url" {
  description = "SQS payment queue URL"
  type        = string
  default     = "https://sqs.us-east-1.amazonaws.com/233636046512/cht-platform-payment-queue"
}

variable "sqs_cme_queue_url" {
  description = "SQS CME queue URL"
  type        = string
  default     = "https://sqs.us-east-1.amazonaws.com/233636046512/cht-platform-cme-queue"
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
  default     = 2
}

variable "min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 4
}

variable "enable_scheduled_scaling" {
  description = "Enabled scheduled ECS scaling (dev only)"
  type        = bool
  default     = false
}