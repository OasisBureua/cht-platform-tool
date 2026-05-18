variable "project" {
  type        = string
  description = "Project name"
}

variable "environment" {
  type        = string
  description = "Environment name"
}

variable "aws_region" {
  type        = string
  description = "AWS region for bucket"
  default     = "us-east-1"
}

variable "cors_allowed_origins" {
  type        = list(string)
  description = "Origins allowed for browser PUT uploads (admin app URLs)"
}
