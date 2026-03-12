variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "s3_bucket_id" {
  description = "S3 bucket ID"
  type        = string
}

variable "s3_bucket_domain_name" {
  description = "S3 bucket domain name"
  type        = string
}

variable "cloudfront_oai_path" {
  description = "CloudFront OAI path"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN (must be in us-east-1)"
  type        = string
  default     = ""
}

variable "domain_aliases" {
  description = "Domain aliases for CloudFront"
  type        = list(string)
  default     = []
}

variable "api_origin_domain" {
  description = "ALB domain for /api/* and /health/* paths (optional, set to empty to disable)"
  type        = string
  default     = ""
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100" # US, Canada, Europe
}

variable "web_acl_id" {
  description = "WAF Web ACL ID for CloudFront (optional)"
  type        = string
  default     = ""
}