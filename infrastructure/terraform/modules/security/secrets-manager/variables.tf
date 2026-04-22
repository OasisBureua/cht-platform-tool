variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "kms_key_id" {
  description = "KMS key ID for secrets encryption"
  type        = string
}

# Database
variable "db_username" {
  description = "Database username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "db_endpoint" {
  description = "Database endpoint"
  type        = string
}

variable "db_port" {
  description = "Database port"
  type        = number
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_connection_string" {
  description = "Database connection string"
  type        = string
  sensitive   = true
}

# Redis
variable "redis_endpoint" {
  description = "Redis endpoint"
  type        = string
}

variable "redis_port" {
  description = "Redis port"
  type        = number
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
  description = "MediaHub Public API key for catalog (clips, tags, doctors, search)"
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
  description = "Zoom webhook Secret Token (from Event Subscriptions - for URL validation)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_sdk_key" {
  description = "Zoom Meeting SDK key (separate Marketplace app from Server-to-Server OAuth)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_sdk_secret" {
  description = "Zoom Meeting SDK secret (Meeting SDK app)"
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
  description = "Optional default webinar intake Jotform URL (stored in app secret JSON; injected as JOTFORM_WEBINAR_DEFAULT_INTAKE_URL on ECS)"
  type        = string
  sensitive   = false
  default     = ""
}

variable "jotform_webinar_post_event_shared_form_id" {
  description = "Optional Jotform form ID for org-wide post-event survey (injected as JOTFORM_WEBINAR_POST_EVENT_SHARED_FORM_ID; skips per-webinar clone when set)"
  type        = string
  sensitive   = false
  default     = ""
}

# Bill.com (payment processing - HCP payouts via ACH/check)
variable "bill_dev_key" {
  description = "Bill.com developer key (from Settings > Sync & Integrations > Manage Developer Keys)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_username" {
  description = "Bill.com account email for API login"
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_password" {
  description = "Bill.com account password for API login"
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_org_id" {
  description = "Bill.com organization ID (from Sync & Integrations page)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_funding_account_id" {
  description = "Bill.com funding account ID (bank account for payouts)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_webhook_secret" {
  description = "Bill.com webhook signing secret for validating payment.updated/payment.failed events"
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