variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "enable_detector" {
  description = "Create GuardDuty detector and EventBridge → SNS routing in this region."
  type        = bool
  default     = true
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for GuardDuty finding notifications"
  type        = string
}
