variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment"
  type        = string
}

variable "secrets_arns" {
  description = "ARNs of secrets to allow access to"
  type        = list(string)
  default     = ["*"]
}

variable "s3_bucket_arns" {
  description = "ARNs of S3 buckets to allow access to"
  type        = list(string)
  default     = []
}

variable "enable_ses" {
  description = "Enable SES email permissions"
  type        = bool
  default     = false
}
