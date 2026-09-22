output "application_id" {
  description = "AppConfig application ID"
  value       = aws_appconfig_application.this.id
}

output "application_name" {
  description = "AppConfig application name"
  value       = aws_appconfig_application.this.name
}

output "environment_id" {
  description = "AppConfig environment ID"
  value       = aws_appconfig_environment.this.environment_id
}

output "environment_name" {
  description = "AppConfig environment name"
  value       = aws_appconfig_environment.this.name
}

output "auth_features_profile_id" {
  description = "AppConfig configuration profile ID for auth-features"
  value       = aws_appconfig_configuration_profile.auth_features.configuration_profile_id
}

output "auth_features_profile_name" {
  description = "AppConfig configuration profile name for auth-features"
  value       = aws_appconfig_configuration_profile.auth_features.name
}

output "auth_features_configuration_arn" {
  description = "ARN for IAM appconfig:StartConfigurationSession / GetLatestConfiguration"
  value       = "arn:aws:appconfig:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:application/${aws_appconfig_application.this.id}/environment/${aws_appconfig_environment.this.environment_id}/configuration/${aws_appconfig_configuration_profile.auth_features.configuration_profile_id}"
}

data "aws_region" "current" {}

data "aws_caller_identity" "current" {}
