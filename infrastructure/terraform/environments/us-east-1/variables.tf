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

variable "secondary_api_origin_domain" {
  description = "Secondary region ALB DNS for CloudFront API origin failover (e.g. us-east-2 backend ALB DNS)."
  type        = string
  default     = ""
}

variable "route_api_to_secondary" {
  description = "Route CloudFront /api* to the secondary ALB (DR drill). Set false to restore primary."
  type        = bool
  default     = false
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

variable "enable_aurora_global" {
  description = "Provision Aurora PostgreSQL Global Database (parallel to RDS during migration)"
  type        = bool
  default     = false
}

variable "aurora_instance_class" {
  description = "Aurora instance class for Global Database primary and secondary"
  type        = string
  default     = "db.r6g.large"
}

variable "aurora_engine_version" {
  description = "Aurora PostgreSQL engine version"
  type        = string
  default     = "15.17"
}

variable "decommission_rds" {
  description = "Remove RDS after Aurora cutover (requires enable_aurora_global)"
  type        = bool
  default     = false
}

variable "aurora_use_for_app" {
  description = "Point app database secrets at Aurora writer (post-DMS cutover)"
  type        = bool
  default     = false
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

# Shared with dev.tfvars / platform.tfvars for deploy-secondary.sh (us-east-2). Not used by this stack.
variable "dr_acm_certificate_arn" {
  description = "ACM certificate ARN for us-east-2 DR ALB (consumed by us-east-2 apply only)."
  type        = string
  default     = ""
}

variable "dr_rds_instance_class" {
  description = "RDS instance class for us-east-2 DR read replica (consumed by us-east-2 apply only)."
  type        = string
  default     = "db.t3.small"
}

# Monitoring
variable "alarm_notification_emails" {
  description = "Email addresses to receive alarm notifications (DLQ, ECS, RDS, ALB, etc.). Must confirm subscription via email."
  type        = list(string)
  default     = []
}

variable "secrets_replica_regions" {
  description = "Secrets Manager replica regions for database/app secrets (e.g. [\"us-east-2\"])."
  type        = list(string)
  default     = []
}

variable "enable_ecr_replication" {
  description = "Replicate cht-platform-* ECR images from us-east-1 to the DR region (account-level; applies on platform or dev apply)."
  type        = bool
  default     = true
}

variable "ecr_replication_destination_region" {
  description = "Destination region for ECR image replication."
  type        = string
  default     = "us-east-2"
}

variable "ecr_repository_prefix" {
  description = "ECR repository name prefix to replicate."
  type        = string
  default     = "cht-platform-"
}

variable "ecr_repository_names" {
  description = "ECR repository names replicated to the DR region."
  type        = list(string)
  default     = ["cht-platform-backend", "cht-platform-worker"]
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

variable "worker_ses_from_email" {
  description = "SES verified From address used by the worker (e.g. noreply@yourdomain.com)"
  type        = string
  default     = "noreply@chtplatform.com"
}

variable "session_reminders_schedule_expression" {
  description = "EventBridge schedule for the session-reminder scan (default: every 3 hours)"
  type        = string
  default     = "cron(0 0/3 * * ? *)"
}

# Cognito
variable "enable_cognito_pools" {
  description = "Create a Cognito User Pool for this environment. Set true in platform.tfvars and dev.tfvars."
  type        = bool
  default     = false
}

variable "cognito_domain_prefix" {
  description = "Cognito hosted UI domain prefix — globally unique across all AWS accounts (e.g. chm-platform)"
  type        = string
  default     = ""
}

variable "cognito_mfa_configuration" {
  description = "MFA enforcement level: OPTIONAL (grace period) or ON (enforced). Flip to ON via platform.tfvars at day 14."
  type        = string
  default     = "OPTIONAL"
}

variable "cognito_user_pool_tier" {
  description = "Cognito user pool tier (LITE/ESSENTIALS/PLUS). Use ESSENTIALS or PLUS for multi-region replication add-on."
  type        = string
  default     = "ESSENTIALS"
}

variable "cognito_google_client_id" {
  description = "Google OAuth client ID for Cognito identity provider (leave empty until creds are ready)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cognito_google_client_secret" {
  description = "Google OAuth client secret for Cognito identity provider (leave empty until creds are ready)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "recaptcha_site_key" {
  description = "Google reCAPTCHA v3 site key (public; baked into frontend build)"
  type        = string
  default     = ""
}

variable "recaptcha_secret_key" {
  description = "Google reCAPTCHA v3 secret key for backend token verification"
  type        = string
  sensitive   = true
  default     = ""
}

variable "recaptcha_min_score" {
  description = "Minimum reCAPTCHA v3 score (0.0–1.0) for login/signup"
  type        = number
  default     = 0.5
}

variable "cognito_email_sending_account" {
  description = "COGNITO_DEFAULT or DEVELOPER (Amazon SES). Use DEVELOPER with cognito_email_from for branded auth emails."
  type        = string
  default     = "COGNITO_DEFAULT"

  validation {
    condition     = contains(["COGNITO_DEFAULT", "DEVELOPER"], var.cognito_email_sending_account)
    error_message = "cognito_email_sending_account must be COGNITO_DEFAULT or DEVELOPER."
  }
}

variable "cognito_email_from" {
  description = "FROM address for Cognito verification/recovery emails (requires SES-verified domain/address in us-east-1)"
  type        = string
  default     = ""
}

variable "cognito_email_reply_to" {
  description = "Optional REPLY-TO for Cognito auth emails"
  type        = string
  default     = ""
}

variable "enable_cognito_waf" {
  description = "Attach regional AWS WAF to the Cognito user pool"
  type        = bool
  default     = false
}

variable "cognito_waf_enable_managed_rules" {
  description = "Enable AWS managed rule groups on the Cognito WAF ACL"
  type        = bool
  default     = true
}

variable "cognito_waf_enable_rate_limit" {
  description = "Enable IP rate limiting on Cognito auth via WAF"
  type        = bool
  default     = true
}

variable "cognito_waf_rate_limit_count" {
  description = "Max Cognito auth requests per 5 minutes per IP"
  type        = number
  default     = 1000
}

variable "enable_cognito_mrr" {
  description = "Create multi-Region KMS keys for Cognito MRR; run scripts/cognito-setup-mrr.sh after apply"
  type        = bool
  default     = false
}

variable "cognito_mrr_replica_region" {
  description = "AWS Region for Cognito user pool replica"
  type        = string
  default     = "us-east-2"
}

variable "cognito_mrr_associate_waf_replica" {
  description = "Associate WAF with Cognito replica pool (set true after cognito-setup-mrr.sh completes)"
  type        = bool
  default     = false
}
