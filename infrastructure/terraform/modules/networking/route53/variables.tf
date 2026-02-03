variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "subdomain_zone" {
  description = "Subdomain zone name (e.g., platform.communityhealth.media)"
  type        = string
}

variable "primary_alb_dns" {
  description = "Primary ALB DNS name"
  type        = string
}

variable "primary_alb_zone_id" {
  description = "Primary ALB zone ID"
  type        = string
}

variable "primary_cloudfront_dns" {
  description = "Primary CloudFront DNS"
  type        = string
}

variable "primary_cloudfront_zone_id" {
  description = "Primary CloudFront zone ID"
  type        = string
}

variable "alarm_actions" {
  description = "SNS topic ARNs for alarms"
  type        = list(string)
  default     = []
}