locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

resource "aws_appconfig_application" "this" {
  name        = local.prefix
  description = "CHT platform feature flags (${var.environment})"
}

resource "aws_appconfig_environment" "this" {
  name           = var.environment
  application_id = aws_appconfig_application.this.id
  description    = "CHT ${var.environment} AppConfig environment"
}

resource "aws_appconfig_configuration_profile" "auth_features" {
  application_id = aws_appconfig_application.this.id
  name           = "auth-features"
  description    = "Authentication feature flags (MFA gate, method)"
  location_uri   = "hosted"
}

resource "aws_appconfig_hosted_configuration_version" "auth_features" {
  application_id           = aws_appconfig_application.this.id
  configuration_profile_id = aws_appconfig_configuration_profile.auth_features.configuration_profile_id
  content                  = var.auth_features_config
  content_type             = "application/json"

  lifecycle {
    ignore_changes = [content]
  }
}

resource "aws_appconfig_deployment_strategy" "immediate" {
  name                           = "${local.prefix}-appconfig-immediate"
  description                    = "Deploy AppConfig changes immediately"
  deployment_duration_in_minutes = 0
  final_bake_time_in_minutes     = 0
  growth_factor                  = 100
  replicate_to                   = "NONE"
}

resource "aws_appconfig_deployment" "auth_features" {
  application_id           = aws_appconfig_application.this.id
  configuration_profile_id = aws_appconfig_configuration_profile.auth_features.configuration_profile_id
  configuration_version    = aws_appconfig_hosted_configuration_version.auth_features.version_number
  deployment_strategy_id     = aws_appconfig_deployment_strategy.immediate.id
  environment_id           = aws_appconfig_environment.this.environment_id
}
