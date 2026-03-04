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
variable "supabase_url" {
  description = "Supabase/GoTrue base URL for auth (set via platform.tfvars or TF_VAR_supabase_url)"
  type        = string
}

variable "supabase_anon_key" {
  description = "Supabase anon key - valid JWT signed with GoTrue secret (set via platform.tfvars or TF_VAR)"
  type        = string
  sensitive   = true
}

variable "gotrue_jwt_secret" {
  description = "GoTrue JWT secret for validating tokens (set via platform.tfvars or TF_VAR)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "mediahub_base_url" {
  description = "MediaHub Public API base URL"
  type        = string
  default     = "https://mediahub.communityhealth.media/api/public"
}

variable "mediahub_api_key" {
  description = "MediaHub Public API key for catalog"
  type        = string
  sensitive   = true
  default     = ""
}

variable "youtube_api_key" {
  description = "YouTube Data API v3 key for catalog playlists (fallback when MediaHub not configured)"
  type        = string
  sensitive   = true
}

variable "youtube_playlist_ids" {
  description = "Comma-separated YouTube playlist IDs for catalog (set via platform.tfvars or TF_VAR_youtube_playlist_ids)"
  type        = string
}

# Zoom (Server-to-Server OAuth for webinars)
variable "zoom_account_id" {
  description = "Zoom Account ID (from Server-to-Server OAuth app at marketplace.zoom.us)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_client_id" {
  description = "Zoom OAuth Client ID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_client_secret" {
  description = "Zoom OAuth Client Secret"
  type        = string
  sensitive   = true
  default     = ""
}

# Jotform (surveys - enterprise at communityhealthmedia.jotform.com)
variable "jotform_api_key" {
  description = "Jotform API key for surveys (from Jotform enterprise account)"
  type        = string
  sensitive   = true
  default     = ""
}

# Bill.com (payment processing - set via TF_VAR_* or dev.tfvars)
variable "bill_dev_key" {
  description = "Bill.com developer key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_username" {
  description = "Bill.com account email"
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_password" {
  description = "Bill.com account password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_org_id" {
  description = "Bill.com organization ID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_funding_account_id" {
  description = "Bill.com funding account ID"
  type        = string
  sensitive   = true
  default     = ""
}

# SQS queue URLs (optional - backend/worker use module.sqs outputs)
variable "sqs_email_queue_url" {
  description = "SQS email queue URL (unused - module.sqs used)"
  type        = string
  default     = ""
}

variable "sqs_payment_queue_url" {
  description = "SQS payment queue URL (unused - module.sqs used)"
  type        = string
  default     = ""
}

variable "sqs_cme_queue_url" {
  description = "SQS CME queue URL (unused - module.sqs used)"
  type        = string
  default     = ""
}
