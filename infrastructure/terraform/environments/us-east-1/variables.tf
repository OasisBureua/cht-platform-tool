variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name (dev/prod)"
  type        = string
}

variable "domain_name" {
  description = "Domain name"
  type        = string
}

# Docker images
variable "backend_image" {
  description = "Backend Docker image"
  type        = string
}

variable "worker_image" {
  description = "Worker Docker image"
  type        = string
}

# Database
variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage (GB)"
  type        = number
}

variable "rds_multi_az" {
  description = "Enable Multi-AZ for RDS"
  type        = bool
}

variable "rds_backup_retention" {
  description = "RDS backup retention period (days)"
  type        = number
}

# Cache
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
}

variable "redis_num_nodes" {
  description = "Number of cache nodes"
  type        = number
}

# Compute - Backend
variable "backend_task_cpu" {
  description = "Backend task CPU"
  type        = number
}

variable "backend_task_memory" {
  description = "Backend task memory"
  type        = number
}

variable "backend_desired_count" {
  description = "Backend desired task count"
  type        = number
}

variable "backend_min_capacity" {
  description = "Backend minimum tasks"
  type        = number
}

variable "backend_max_capacity" {
  description = "Backend maximum tasks"
  type        = number
}

# Compute - Worker
variable "worker_task_cpu" {
  description = "Worker task CPU"
  type        = number
}

variable "worker_task_memory" {
  description = "Worker task memory"
  type        = number
}

variable "worker_desired_count" {
  description = "Worker desired task count"
  type        = number
}

variable "worker_min_capacity" {
  description = "Worker minimum tasks"
  type        = number
}

variable "worker_max_capacity" {
  description = "Worker maximum tasks"
  type        = number
}

# SSL Certificates
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

# Monitoring
variable "sns_topic_arn" {
  description = "SNS topic ARN for alarms"
  type        = string
  default     = ""
}

# Application secrets
variable "stripe_secret_key" {
  description = "Stripe secret key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_publishable_key" {
  description = "Stripe publishable key"
  type        = string
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "hubspot_smtp_user" {
  description = "HubSpot SMTP username (from transactional email token)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "hubspot_smtp_password" {
  description = "HubSpot SMTP password (from transactional email token)"
  type        = string
  sensitive   = true
  default     = ""
}

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