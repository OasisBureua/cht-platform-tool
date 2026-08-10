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
  # KeyConfiguration on every update; AWS provider 5.x cannot send it. Ignore in-place
  # pool setting changes here and apply them via scripts/cognito-sync-pool-config.sh.
  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      name,
      username_attributes,
      auto_verified_attributes,
      mfa_configuration,
      email_configuration,
      password_policy,
      schema,
      username_configuration,
      account_recovery_setting,
      admin_create_user_config,
      verification_message_template,
      software_token_mfa_configuration,
      user_pool_tier,
    ]
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
