variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, platform, etc.)"
  type        = string
}

variable "auth_features_config" {
  description = "Initial hosted JSON for the auth-features profile"
  type        = string
  default     = <<-EOF
    {
      "mfa": {
        "enabled": false,
        "method": "sms"
      }
    }
  EOF
}
