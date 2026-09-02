# Shared tfvars (dev.tfvars / platform.tfvars) are used for both deploy-primary.sh
# and deploy-secondary.sh. Declare primary-region-only keys here so Terraform does
# not warn about undeclared variables; this stack does not consume them.

variable "secondary_api_origin_domain" {
  description = "Primary only: CloudFront API origin failover target (us-east-2 ALB DNS)."
  type        = string
  default     = ""
}

variable "rds_instance_class" {
  description = "Primary only: RDS instance class in us-east-1."
  type        = string
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  description = "Primary only: RDS allocated storage (GB) in us-east-1."
  type        = number
  default     = 20
}

variable "rds_multi_az" {
  description = "Primary only: enable Multi-AZ on us-east-1 RDS."
  type        = bool
  default     = false
}

variable "rds_backup_retention" {
  description = "RDS backup retention (days) for primary us-east-1 and DR read replica."
  type        = number
  default     = 1
}

variable "cloudfront_certificate_arn" {
  description = "Primary only: ACM certificate for CloudFront (us-east-1)."
  type        = string
  default     = ""
}

variable "secrets_replica_regions" {
  description = "Primary only: Secrets Manager replica regions."
  type        = list(string)
  default     = []
}

variable "enable_ecr_replication" {
  description = "Primary only: replicate ECR images to DR region."
  type        = bool
  default     = true
}

variable "ecr_replication_destination_region" {
  description = "Primary only: ECR replication destination region."
  type        = string
  default     = "us-east-2"
}

variable "ecr_repository_prefixes" {
  description = "Primary only: PREFIX_MATCH filters for account ECR replication (contenthub- + cht-platform-)."
  type        = list(string)
  default     = ["contenthub-", "cht-platform-"]
}

variable "ecr_repository_names" {
  description = "Primary only: ECR repository names replicated to DR."
  type        = list(string)
  default     = ["cht-platform-backend", "cht-platform-worker"]
}

variable "contenthub_base_url" {
  description = "Primary only: Content Hub API base URL."
  type        = string
  default     = ""
}

variable "contenthub_api_key" {
  description = "Primary only: Content Hub PUBLIC_API_KEY."
  type        = string
  sensitive   = true
  default     = ""
}

variable "internal_cache_secret" {
  description = "Primary only: shared secret for POST /api/internal/cache/clear."
  type        = string
  sensitive   = true
  default     = ""
}

variable "youtube_api_key" {
  description = "Primary only: YouTube Data API key."
  type        = string
  sensitive   = true
  default     = ""
}

variable "youtube_playlist_ids" {
  description = "Primary only: comma-separated YouTube playlist IDs."
  type        = string
  default     = ""
}

variable "zoom_account_id" {
  description = "Primary only: Zoom account ID."
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_client_id" {
  description = "Primary only: Zoom OAuth client ID."
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_client_secret" {
  description = "Primary only: Zoom OAuth client secret."
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_webhook_secret" {
  description = "Primary only: Zoom webhook secret."
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_sdk_key" {
  description = "Primary only: Zoom Meeting SDK key."
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_sdk_secret" {
  description = "Primary only: Zoom Meeting SDK secret."
  type        = string
  sensitive   = true
  default     = ""
}

variable "jotform_api_key" {
  description = "Primary only: Jotform API key."
  type        = string
  sensitive   = true
  default     = ""
}

variable "jotform_webinar_default_intake_url" {
  description = "Primary only: default webinar intake Jotform URL."
  type        = string
  default     = ""
}

variable "jotform_webinar_post_event_shared_form_id" {
  description = "Primary only: shared post-event Jotform ID."
  type        = string
  default     = ""
}

variable "bill_dev_key" {
  description = "Primary only: Bill.com developer key."
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_username" {
  description = "Primary only: Bill.com username."
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_password" {
  description = "Primary only: Bill.com password."
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_org_id" {
  description = "Primary only: Bill.com org ID."
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_funding_account_id" {
  description = "Primary only: Bill.com funding account ID."
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_webhook_secret" {
  description = "Primary only: Bill.com webhook secret."
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_mfa_remember_me_id" {
  description = "Primary only: Bill.com MFA remember-me ID."
  type        = string
  sensitive   = true
  default     = ""
}

variable "bill_mfa_device_name" {
  description = "Primary only: Bill.com MFA device name."
  type        = string
  sensitive   = true
  default     = ""
}

variable "admin_bootstrap_secret" {
  description = "Primary only: admin bootstrap secret."
  type        = string
  sensitive   = true
  default     = ""
}

variable "hubspot_access_token" {
  description = "Primary only: HubSpot access token."
  type        = string
  sensitive   = true
  default     = ""
}

variable "sqs_email_queue_url" {
  description = "Primary only: unused SQS email queue URL override."
  type        = string
  default     = ""
}

variable "sqs_payment_queue_url" {
  description = "Primary only: unused SQS payment queue URL override."
  type        = string
  default     = ""
}

variable "sqs_cme_queue_url" {
  description = "Primary only: unused SQS CME queue URL override."
  type        = string
  default     = ""
}

variable "enable_cognito_pools" {
  description = "Primary only: create Cognito user pool in us-east-1."
  type        = bool
  default     = false
}

variable "cognito_domain_prefix" {
  description = "Primary only: Cognito hosted UI domain prefix."
  type        = string
  default     = ""
}

variable "cognito_mfa_configuration" {
  description = "Primary only: Cognito MFA configuration."
  type        = string
  default     = "OPTIONAL"
}

variable "cognito_user_pool_tier" {
  description = "Primary only: Cognito user pool tier."
  type        = string
  default     = "ESSENTIALS"
}

variable "cognito_google_client_id" {
  description = "Primary only: Google OAuth client ID for Cognito."
  type        = string
  sensitive   = true
  default     = ""
}

variable "cognito_google_client_secret" {
  description = "Primary only: Google OAuth client secret for Cognito."
  type        = string
  sensitive   = true
  default     = ""
}

variable "cognito_email_sending_account" {
  description = "Primary only: Cognito email sending account mode."
  type        = string
  default     = "COGNITO_DEFAULT"
}

variable "cognito_email_from" {
  description = "Primary only: Cognito FROM address."
  type        = string
  default     = ""
}

variable "cognito_email_reply_to" {
  description = "Primary only: Cognito REPLY-TO address."
  type        = string
  default     = ""
}

variable "enable_cognito_waf" {
  description = "Primary only: attach WAF to Cognito user pool."
  type        = bool
  default     = false
}

variable "cognito_waf_enable_managed_rules" {
  description = "Primary only: Cognito WAF managed rules."
  type        = bool
  default     = true
}

variable "cognito_waf_enable_rate_limit" {
  description = "Primary only: Cognito WAF rate limiting."
  type        = bool
  default     = true
}

variable "cognito_waf_rate_limit_count" {
  description = "Primary only: Cognito WAF rate limit count."
  type        = number
  default     = 1000
}

variable "enable_cognito_mrr" {
  description = "Primary only: Cognito multi-region replication."
  type        = bool
  default     = false
}

variable "cognito_mrr_replica_region" {
  description = "Primary only: Cognito MRR replica region."
  type        = string
  default     = "us-east-2"
}

variable "cognito_mrr_associate_waf_replica" {
  description = "Primary only: associate WAF with Cognito replica pool."
  type        = bool
  default     = false
}
