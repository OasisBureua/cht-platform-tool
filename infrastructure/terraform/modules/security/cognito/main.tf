data "aws_region" "current" {}

data "aws_caller_identity" "current" {}

locals {
  # Matches the resource_prefix convention used in the us-east-1 environment
  name_prefix   = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
  enable_google = var.google_client_id != "" && var.google_client_secret != ""

  use_ses_email = var.email_sending_account == "DEVELOPER" && var.email_from_address != ""

  ses_domain = local.use_ses_email && var.ses_source_arn == "" ? element(split("@", var.email_from_address), 1) : ""

  ses_source_arn = local.use_ses_email ? (
    var.ses_source_arn != "" ? var.ses_source_arn :
    "arn:aws:ses:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:identity/${local.ses_domain}"
  ) : ""

  hosted_ui_base_url = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"

  # Doc naming: cht-hub-m2m-prod / cht-prod-cognito-m2m-hub (TF env "platform" → prod)
  env_label = var.environment == "platform" ? "prod" : var.environment

  m2m_export_scope      = "${aws_cognito_resource_server.platform.identifier}/export.read"
  m2m_cache_clear_scope = "${aws_cognito_resource_server.platform.identifier}/cache.clear"
  m2m_hub_client_scopes = "${local.m2m_export_scope} ${local.m2m_cache_clear_scope}"

  m2m_hub_client_name   = "cht-hub-m2m-${local.env_label}"
  m2m_hub_secret_name   = "cht-${local.env_label}-cognito-m2m-hub"
  m2m_platform_client_name = "cht-platform-m2m-${local.env_label}"
  m2m_platform_secret_name = "cht-${local.env_label}-cognito-m2m-platform"
}

# ============================================
# Cognito User Pool
# ============================================
resource "aws_cognito_user_pool" "main" {
  name           = "${local.name_prefix}-users"
  user_pool_tier = var.user_pool_tier

  # Email is the username; no separate username field
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  username_configuration {
    case_sensitive = false
  }

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  # MFA: keep OPTIONAL while the app soft-gates /mfa/setup for all roles; flip to ON after enrollments.
  mfa_configuration = var.mfa_configuration

  software_token_mfa_configuration {
    enabled = true
  }

  # SMS MFA / phone verification. Existing pools are updated via
  # scripts/cognito-sync-pool-config.sh (lifecycle ignores in-place pool MFA drift).
  dynamic "sms_configuration" {
    for_each = var.enable_sms_mfa ? [1] : []
    content {
      external_id    = local.sms_external_id
      sns_caller_arn = aws_iam_role.cognito_sms[0].arn
      sns_region     = data.aws_region.current.name
    }
  }

  # COGNITO_DEFAULT → no-reply@verificationemail.com (dev only).
  # DEVELOPER → verified SES identity in us-east-1 (recommended for dev + platform).
  dynamic "email_configuration" {
    for_each = local.use_ses_email ? [1] : []
    content {
      email_sending_account  = "DEVELOPER"
      from_email_address     = var.email_from_address
      reply_to_email_address = var.email_reply_to_address != "" ? var.email_reply_to_address : null
      source_arn             = local.ses_source_arn
    }
  }

  dynamic "email_configuration" {
    for_each = local.use_ses_email ? [] : [1]
    content {
      email_sending_account = "COGNITO_DEFAULT"
    }
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = var.verification_email_subject
    email_message        = var.verification_email_message
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Open sign-up: users can register without admin invite
  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  schema {
    attribute_data_type = "String"
    name                = "email"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 3
      max_length = 255
    }
  }

  # Cognito UpdateUserPool resets omitted fields. MRR-enabled pools also require
  # KeyConfiguration on every update; AWS provider 5.x cannot send it — any
  # in-place UpdateUserPool then fails with:
  #   "Using an AWS owned KMS key is not supported for a user pool with
  #    multi-region replication enabled."
  # Ignore ALL in-place pool drift. Apply email/SMS/MFA/issuer via
  # scripts/cognito-sync-pool-config.sh (and cognito-setup-mrr.sh) instead.
  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}

# ============================================
# Cognito Hosted UI Domain
# ============================================
resource "aws_cognito_user_pool_domain" "main" {
  domain       = var.domain_prefix
  user_pool_id = aws_cognito_user_pool.main.id
}

# ============================================
# App Client: cht-web (PKCE public client)
# ============================================
resource "aws_cognito_user_pool_client" "cht_web" {
  name         = var.app_client_name
  user_pool_id = aws_cognito_user_pool.main.id

  # Public client: no secret; PKCE enforced by the frontend
  generate_secret = false

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes = [
    "email",
    "openid",
    "profile",
    # Required for AssociateSoftwareToken / SetUserMFAPreference with OAuth access tokens
    # (Hosted UI / Google). USER_PASSWORD_AUTH tokens already include this scope.
    "aws.cognito.signin.user.admin",
  ]

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  supported_identity_providers = concat(
    ["COGNITO"],
    local.enable_google ? ["Google"] : []
  )

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  # Match console: 3-minute auth flow session, token revocation enabled
  auth_session_validity   = 3
  enable_token_revocation = true

  # Prevents leaking whether an email is registered
  prevent_user_existence_errors = "ENABLED"

  depends_on = [aws_cognito_identity_provider.google]
}

# ============================================
# Resource server: CHT Platform API (identifier: platform)
# Hub (and others) request platform/… scopes with their own clients.
# ============================================
resource "aws_cognito_resource_server" "platform" {
  identifier   = "platform"
  name         = "CHT Platform API"
  user_pool_id = aws_cognito_user_pool.main.id

  scope {
    scope_name        = "export.read"
    scope_description = "Read platform export endpoints (Hub scheduled ingest)"
  }

  scope {
    scope_name        = "cache.clear"
    scope_description = "Clear platform Redis upstream cache (Hub / ops)"
  }
}

# Hub → platform (export + cache.clear). One Hub identity per env.
resource "aws_cognito_user_pool_client" "hub_m2m" {
  name         = local.m2m_hub_client_name
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = true

  allowed_oauth_flows                  = ["client_credentials"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes = [
    local.m2m_export_scope,
    local.m2m_cache_clear_scope,
  ]

  supported_identity_providers = ["COGNITO"]

  token_validity_units {
    access_token = "hours"
  }
  access_token_validity = 1

  enable_token_revocation       = true
  prevent_user_existence_errors = "ENABLED"

  depends_on = [aws_cognito_resource_server.platform]
}

resource "aws_secretsmanager_secret" "m2m_hub" {
  name                    = local.m2m_hub_secret_name
  description             = "Cognito M2M for Hub → platform (scopes platform/export.read platform/cache.clear). Client ${local.m2m_hub_client_name}."
  recovery_window_in_days = 30

  tags = {
    Name        = local.m2m_hub_secret_name
    Environment = local.env_label
    Purpose     = "hub-m2m"
  }
}

resource "aws_secretsmanager_secret_version" "m2m_hub" {
  secret_id = aws_secretsmanager_secret.m2m_hub.id
  secret_string = jsonencode({
    client_id     = aws_cognito_user_pool_client.hub_m2m.id
    client_secret = aws_cognito_user_pool_client.hub_m2m.client_secret
    token_url     = "${local.hosted_ui_base_url}/oauth2/token"
    scope         = local.m2m_hub_client_scopes
  })
}

# Platform → Hub. Requires Hub resource server `hub` on this pool first
# (Content Hub terraform). Set enable_platform_outbound_m2m = true after Hub RS exists.
resource "aws_cognito_user_pool_client" "platform_m2m" {
  count = var.enable_platform_outbound_m2m ? 1 : 0

  name         = local.m2m_platform_client_name
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = true

  allowed_oauth_flows                  = ["client_credentials"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = var.platform_outbound_hub_scopes

  supported_identity_providers = ["COGNITO"]

  token_validity_units {
    access_token = "hours"
  }
  access_token_validity = 1

  enable_token_revocation       = true
  prevent_user_existence_errors = "ENABLED"
}

resource "aws_secretsmanager_secret" "m2m_platform" {
  count = var.enable_platform_outbound_m2m ? 1 : 0

  name                    = local.m2m_platform_secret_name
  description             = "Cognito M2M for Platform → Hub (hub/… scopes). Client ${local.m2m_platform_client_name}."
  recovery_window_in_days = 30

  tags = {
    Name        = local.m2m_platform_secret_name
    Environment = local.env_label
    Purpose     = "platform-m2m"
  }
}

resource "aws_secretsmanager_secret_version" "m2m_platform" {
  count = var.enable_platform_outbound_m2m ? 1 : 0

  secret_id = aws_secretsmanager_secret.m2m_platform[0].id
  secret_string = jsonencode({
    client_id     = aws_cognito_user_pool_client.platform_m2m[0].id
    client_secret = aws_cognito_user_pool_client.platform_m2m[0].client_secret
    token_url     = "${local.hosted_ui_base_url}/oauth2/token"
    scope         = join(" ", var.platform_outbound_hub_scopes)
  })
}

moved {
  from = aws_cognito_user_pool_client.content_hub_export
  to   = aws_cognito_user_pool_client.hub_m2m
}

moved {
  from = aws_secretsmanager_secret.m2m_export
  to   = aws_secretsmanager_secret.m2m_hub
}

moved {
  from = aws_secretsmanager_secret_version.m2m_export
  to   = aws_secretsmanager_secret_version.m2m_hub
}

# ============================================
# User Groups
# ============================================
resource "aws_cognito_user_group" "users" {
  name         = "cht-hcp"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Standard CHT platform HCP"
}

resource "aws_cognito_user_group" "admin" {
  name         = "cht-admin"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "CHT platform administrators"
}

# Future: add cht-kol and cht-industry groups here when needed, 
# no pool migration required, just new aws_cognito_user_group resources.

# ============================================
# Google Identity Provider (optional)
# Created only when cognito_google_client_id is set in tfvars
# ============================================
resource "aws_cognito_identity_provider" "google" {
  count = local.enable_google ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
    authorize_scopes = "email profile openid"
  }

  attribute_mapping = {
    email          = "email"
    email_verified = "email_verified"
    name           = "name"
    username       = "sub"
  }
}
