variable "project" {
  description = "Project name"
  type        = string
  default     = "cht-platform"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "backend_image" {
  description = "Backend Docker image"
  type        = string
}

variable "worker_image" {
  description = "Worker Docker image"
  type        = string
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for ALB"
  type        = string
  default     = ""
}

variable "cloudfront_certificate_arn" {
  description = "ACM certificate ARN for CloudFront (must be in us-east-1)"
  type        = string
  default     = ""
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for alarms"
  type        = string
  default     = ""
}

# Application secrets
variable "auth0_domain" {
  description = "Auth0 domain"
  type        = string
  default     = ""
}

variable "auth0_client_id" {
  description = "Auth0 client ID"
  type        = string
  default     = ""
}

variable "auth0_audience" {
  description = "Auth0 audience"
  type        = string
  default     = ""
}