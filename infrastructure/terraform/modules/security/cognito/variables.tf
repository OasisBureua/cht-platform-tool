variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "user_pool_tier" {
  description = "Cognito user pool tier required for advanced capabilities (LITE, ESSENTIALS, PLUS)."
  type        = string
  default     = "ESSENTIALS"

  validation {
    condition     = contains(["LITE", "ESSENTIALS", "PLUS"], var.user_pool_tier)
    error_message = "user_pool_tier must be LITE, ESSENTIALS, or PLUS."
  }
}

variable "domain_prefix" {
  description = "Cognito hosted UI domain prefix: must be globally unique across all AWS accounts (e.g. chm-platform)"
  type        = string
}

variable "callback_urls" {
  description = "Allowed OAuth callback URLs for the cht-web app client"
  type        = list(string)
}

variable "logout_urls" {
  description = "Allowed logout URLs for the cht-web app client"
  type        = list(string)
}

variable "app_client_name" {
  description = "Display name for the public OAuth app client (shown on Cognito Hosted UI / Google consent when configured to match)"
  type        = string
  default     = "Community Health Media"
}

variable "mfa_configuration" {
  description = "MFA enforcement level: OPTIONAL (grace period) or ON (enforced after day 14 post-cutover)"
  type        = string
  default     = "OPTIONAL"

  validation {
    condition     = contains(["OFF", "OPTIONAL", "ON"], var.mfa_configuration)
    error_message = "mfa_configuration must be OFF, OPTIONAL, or ON."
  }
}

variable "google_client_id" {
  description = "Google OAuth client ID for Cognito identity provider federation (leave empty to skip)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret for Cognito identity provider federation (leave empty to skip)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "email_sending_account" {
  description = "COGNITO_DEFAULT (limited FROM address) or DEVELOPER (Amazon SES in this region)"
  type        = string
  default     = "COGNITO_DEFAULT"

  validation {
    condition     = contains(["COGNITO_DEFAULT", "DEVELOPER"], var.email_sending_account)
    error_message = "email_sending_account must be COGNITO_DEFAULT or DEVELOPER."
  }
}

variable "email_from_address" {
  description = "FROM address for Cognito verification/recovery emails (required when email_sending_account = DEVELOPER)"
  type        = string
  default     = ""
}

variable "email_reply_to_address" {
  description = "Optional REPLY-TO for Cognito emails"
  type        = string
  default     = ""
}

variable "ses_source_arn" {
  description = "SES identity ARN for DEVELOPER mode. Leave empty to derive from email_from_address domain."
  type        = string
  default     = ""
}

variable "verification_email_subject" {
  description = "Subject line for Cognito email verification messages"
  type        = string
  default     = "Verify your Community Health account"
}

variable "verification_email_message" {
  description = "Body for Cognito email verification (must include {####} placeholder for the code)"
  type        = string
  default     = "Your verification code is {####}."
}

variable "enable_waf" {
  description = "Attach a regional AWS WAF web ACL to the Cognito user pool"
  type        = bool
  default     = false
}

variable "waf_enable_managed_rules" {
  description = "Enable AWS managed WAF rule groups on the Cognito web ACL"
  type        = bool
  default     = true
}

variable "waf_enable_rate_limit" {
  description = "Enable IP rate limiting on Cognito auth endpoints"
  type        = bool
  default     = true
}

variable "waf_rate_limit_count" {
  description = "Max Cognito auth requests per 5 minutes per IP"
  type        = number
  default     = 1000
}

variable "waf_allowed_countries" {
  description = "Optional geo allow-list (ISO 3166-1 alpha-2). Empty = allow all."
  type        = list(string)
  default     = []
}

variable "enable_multi_region_replication" {
  description = "Provision multi-Region KMS keys for Cognito MRR (run scripts/cognito-setup-mrr.sh after apply)"
  type        = bool
  default     = false
}

variable "replica_region" {
  description = "AWS Region for the Cognito user pool replica (e.g. us-east-2)"
  type        = string
  default     = "us-east-2"
}

variable "kms_deletion_window_in_days" {
  description = "KMS key deletion window for Cognito MRR keys"
  type        = number
  default     = 30
}

variable "associate_waf_with_replica" {
  description = "Associate the replica-region WAF ACL with the Cognito replica pool (requires MRR setup script completed first)"
  type        = bool
  default     = false
}
