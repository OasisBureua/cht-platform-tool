locals {
  # Matches the resource_prefix convention used in the us-east-1 environment
  name_prefix    = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
  enable_google  = var.google_client_id != "" && var.google_client_secret != ""
}

# ============================================
# Cognito User Pool
# ============================================
resource "aws_cognito_user_pool" "main" {
  name = "${local.name_prefix}-users"
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

  # MFA: OPTIONAL at launch, flipped to ON via platform.tfvars at day 14
  mfa_configuration = var.mfa_configuration

  software_token_mfa_configuration {
    enabled = true
  }

  # Use Cognito's default SES for now; swap to custom SES domain when verified
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Open sign-up — users can register without admin invite
  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  schema {
    attribute_data_type      = "String"
    name                     = "email"
    required                 = true
    mutable                  = true

    string_attribute_constraints {
      min_length = 3
      max_length = 255
    }
  }

  # Retain pool if Terraform is accidentally asked to destroy it
  lifecycle {
    prevent_destroy = true
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
# App Client — cht-web (PKCE public client)
# ============================================
resource "aws_cognito_user_pool_client" "cht_web" {
  name         = "cht-web"
  user_pool_id = aws_cognito_user_pool.main.id

  # Public client — no secret; PKCE enforced by the frontend
  generate_secret = false

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

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

# Future: add cht-kol and cht-industry groups here when needed —
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
