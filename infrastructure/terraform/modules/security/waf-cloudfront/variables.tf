variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "enable_managed_rules" {
  description = "Enable AWS managed rule sets (CommonRuleSet, KnownBadInputs)"
  type        = bool
  default     = true
}

variable "enable_rate_limit" {
  description = "Enable rate-based rule (limit requests per 5 min per IP)"
  type        = bool
  default     = true
}

variable "rate_limit_count" {
  description = "Max requests per 5 minutes per IP when rate limit enabled"
  type        = number
  default     = 2000
}

variable "allowed_countries" {
  description = "List of ISO 3166-1 alpha-2 country codes to allow (empty = allow all)"
  type        = list(string)
  default     = []
}
