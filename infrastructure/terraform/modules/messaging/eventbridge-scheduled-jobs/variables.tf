variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment slug"
  type        = string
}

variable "scheduled_jobs_queue_arn" {
  description = "ARN of the SQS queue that receives scheduled-job trigger payloads"
  type        = string
}

variable "scheduled_jobs_queue_url" {
  description = "URL of the SQS queue (used for queue policy attachment)"
  type        = string
}

variable "session_reminders_schedule" {
  description = "EventBridge schedule expression (UTC) for the session-reminder scan. Default: every 3 hours."
  type        = string
  default     = "rate(3 hours)"
}
