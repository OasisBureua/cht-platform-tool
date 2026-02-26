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