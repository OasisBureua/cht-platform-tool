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

variable "rds_engine_version" {
  description = "PostgreSQL engine version — must match or exceed the version currently running in AWS (downgrades are not allowed)"
  type        = string
  default     = "15.17"
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
variable "alarm_notification_emails" {
  description = "Email addresses to receive alarm notifications (DLQ, ECS, RDS, ALB, etc.). Must confirm subscription via email."
  type        = list(string)
  default     = []
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

variable "zoom_webhook_secret" {
  description = "Zoom webhook Secret Token (from Event Subscriptions)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_sdk_key" {
  description = "Zoom Meeting SDK Client ID / SDK Key (in-browser join — separate from Server-to-Server OAuth)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_sdk_secret" {
  description = "Zoom Meeting SDK Client Secret (Meeting SDK app at marketplace.zoom.us)"
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

variable "jotform_webinar_default_intake_url" {
  description = "Optional public Jotform URL for webinar registration when a Program has no jotformIntakeFormUrl (set in Admin). Passed to backend as JOTFORM_WEBINAR_DEFAULT_INTAKE_URL."
  type        = string
  sensitive   = false
  default     = ""
}

variable "jotform_webinar_post_event_shared_form_id" {
  description = "Optional Jotform form ID for shared post-event survey (JOTFORM_WEBINAR_POST_EVENT_SHARED_FORM_ID on ECS)"
  type        = string
  sensitive   = false
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

variable "bill_webhook_secret" {
  description = "Bill.com webhook signing secret for validating payment events"
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_mfa_remember_me_id" {
  description = "Bill MFA remember-me id (~30d); from /v3/mfa/challenge/validate with rememberMe true"
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_mfa_device_name" {
  description = "Must match the device string used when obtaining rememberMeId"
  type        = string
  sensitive   = true
  default     = ""
}

variable "admin_bootstrap_secret" {
  description = "One-time secret to promote the first admin via POST /api/admin/bootstrap"
  type        = string
  sensitive   = true
  default     = ""
}

variable "hubspot_access_token" {
  description = "HubSpot private app or Service Key token for CRM contact sync"
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
