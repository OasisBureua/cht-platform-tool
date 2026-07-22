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

# ── Bill.com MFA rememberMeId expiry reminder ────────────────────────────────
variable "enable_bill_mfa_reminder" {
  description = "When true, schedules an EventBridge rule that emails (via the alerts SNS topic) a reminder to refresh the Bill.com MFA rememberMeId before it expires."
  type        = bool
  default     = false
}

variable "alerts_topic_arn" {
  description = "ARN of the SNS alerts topic used to deliver the Bill.com MFA reminder. Required when enable_bill_mfa_reminder = true."
  type        = string
  default     = ""
}

variable "bill_mfa_reminder_schedule" {
  description = "EventBridge schedule expression for the Bill.com MFA reminder. rememberMeId expires ~30 days after it is set, so fire well before that (default: every 20 days)."
  type        = string
  default     = "rate(20 days)"
}
