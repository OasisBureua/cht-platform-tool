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
  description = "Cognito hosted UI domain prefix — must be globally unique across all AWS accounts (e.g. chm-platform)"
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
