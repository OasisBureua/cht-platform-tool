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
  description = "EventBridge schedule for the Bill.com MFA reminder. Default rate(20 days) first fires 20 days after the rule is applied."
  type        = string
  default     = "rate(20 days)"

  validation {
    condition     = can(regex("^rate\\(20 days\\)$|^cron\\(.+\\)$", var.bill_mfa_reminder_schedule))
    error_message = "bill_mfa_reminder_schedule must be rate(20 days) or a cron(...) expression."
  }
}
