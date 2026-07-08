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

variable "cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "db_instance_id" {
  description = "RDS instance ID"
  type        = string
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix for metrics"
  type        = string
}

variable "log_group_name" {
  description = "CloudWatch log group name"
  type        = string
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for alarms"
  type        = string
  default     = ""
}
