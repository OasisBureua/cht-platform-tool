output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "client_id" {
  description = "cht-web app client ID (public PKCE client)"
  value       = aws_cognito_user_pool_client.cht_web.id
}

output "hosted_ui_base_url" {
  description = "Cognito Hosted UI base URL (used for Google OAuth redirect)"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

output "jwks_uri" {
  description = "JWKS endpoint for validating Cognito JWTs in the backend"
  value       = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.main.id}/.well-known/jwks.json"
}

output "issuer_url" {
  description = "JWT issuer URL (iss claim in Cognito tokens)"
  value       = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

output "multi_region_replication_supported" {
  description = "Whether Cognito service supports native cross-region replication."
  value       = true
}

output "multi_region_replication_managed_in_module" {
  description = "Whether this Terraform module currently configures Cognito multi-region replication."
  value       = false
}

data "aws_region" "current" {}
