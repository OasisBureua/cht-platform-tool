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

variable "min_severity" {
  description = <<-EOT
    Minimum GuardDuty severity to email via SNS (EventBridge filter).
    Low = 0.1–3.9, Medium = 4.0–6.9, High = 7.0–8.9.
    Default 4.0 (Medium+) stops low-noise findings (port probes, routine root console API calls)
    while keeping Medium/High alerts. Set to 7.0 for High/Critical only (matches IR SEV-2).
  EOT
  type        = number
  default     = 4.0

  validation {
    condition     = var.min_severity >= 0 && var.min_severity <= 8.9
    error_message = "min_severity must be between 0 and 8.9."
  }
}

variable "finding_publishing_frequency" {
  description = "How often GuardDuty republishes updates for an existing finding to EventBridge (FIFTEEN_MINUTES | ONE_HOUR | SIX_HOURS)."
  type        = string
  default     = "SIX_HOURS"

  validation {
    condition = contains(
      ["FIFTEEN_MINUTES", "ONE_HOUR", "SIX_HOURS"],
      var.finding_publishing_frequency,
    )
    error_message = "finding_publishing_frequency must be FIFTEEN_MINUTES, ONE_HOUR, or SIX_HOURS."
  }
}

variable "excluded_finding_types" {
  description = "Optional GuardDuty finding type strings to never email (still visible in the GuardDuty console)."
  type        = list(string)
  default     = []
}
