# =============================================================================
# Secrets Manager - Master Credentials
# =============================================================================

locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

# Database credentials (master from RDS)
resource "aws_secretsmanager_secret" "database" {
  name                    = "${local.prefix}-database-credentials"
  description             = "Database credentials for ${var.project} ${var.environment}"
  kms_key_id              = var.kms_key_id
  recovery_window_in_days = 30

  tags = {
    Name        = "${local.prefix}-database-credentials"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
    host     = var.db_endpoint
    port     = var.db_port
    dbname   = var.db_name
    url      = var.db_connection_string
  })
}

# Application secrets (API keys, etc. - master from tfvars)
resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${local.prefix}-app-secrets"
  description             = "Application secrets for ${var.project} ${var.environment}"
  kms_key_id              = var.kms_key_id
  recovery_window_in_days = 30

  tags = {
    Name        = "${local.prefix}-app-secrets"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    supabase_url                              = var.supabase_url
    supabase_anon_key                         = var.supabase_anon_key
    gotrue_jwt_secret                         = var.gotrue_jwt_secret
    mediahub_base_url                         = var.mediahub_base_url
    mediahub_api_key                          = var.mediahub_api_key
    youtube_api_key                           = var.youtube_api_key
    youtube_playlist_ids                      = var.youtube_playlist_ids
    zoom_account_id                           = var.zoom_account_id
    zoom_client_id                            = var.zoom_client_id
    zoom_client_secret                        = var.zoom_client_secret
    zoom_webhook_secret                       = var.zoom_webhook_secret
    zoom_sdk_key                              = var.zoom_sdk_key
    zoom_sdk_secret                           = var.zoom_sdk_secret
    jotform_api_key                           = var.jotform_api_key
    jotform_webinar_default_intake_url        = var.jotform_webinar_default_intake_url
    jotform_webinar_post_event_shared_form_id = var.jotform_webinar_post_event_shared_form_id
    bill_dev_key                              = var.bill_dev_key
    bill_username                             = var.bill_username
    bill_password                             = var.bill_password
    bill_org_id                               = var.bill_org_id
    bill_funding_account_id                   = var.bill_funding_account_id
    bill_webhook_secret                       = var.bill_webhook_secret
    bill_mfa_remember_me_id                   = var.bill_mfa_remember_me_id
    bill_mfa_device_name                      = var.bill_mfa_device_name
    admin_bootstrap_secret                    = var.admin_bootstrap_secret
    hubspot_access_token                      = var.hubspot_access_token
  })
}