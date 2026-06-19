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
  value       = var.enable_multi_region_replication
}

output "cognito_kms_key_arn" {
  description = "Multi-Region KMS key ARN for Cognito user pool encryption (primary)"
  value       = var.enable_multi_region_replication ? aws_kms_key.cognito_mrk[0].arn : null
}

output "cognito_kms_replica_key_arn" {
  description = "Multi-Region KMS replica key ARN in the replica region"
  value       = var.enable_multi_region_replication ? aws_kms_replica_key.cognito_mrk[0].arn : null
}

output "cognito_waf_web_acl_arn" {
  description = "Regional WAF web ACL ARN associated with the primary Cognito user pool"
  value       = var.enable_waf ? module.waf_primary[0].web_acl_arn : null
}

output "cognito_waf_replica_web_acl_arn" {
  description = "Regional WAF web ACL ARN in the replica region (for MRR)"
  value       = var.enable_waf && var.enable_multi_region_replication ? module.waf_replica[0].web_acl_arn : null
}

output "replica_user_pool_arn" {
  description = "Expected ARN of the Cognito replica user pool after MRR setup"
  value       = var.enable_multi_region_replication ? local.replica_user_pool_arn : null
}

output "email_sending_account" {
  description = "Email sending mode configured on the user pool"
  value       = local.use_ses_email ? "DEVELOPER" : "COGNITO_DEFAULT"
}

output "email_from_address" {
  description = "FROM address for Cognito emails (null when using COGNITO_DEFAULT)"
  value       = local.use_ses_email ? var.email_from_address : null
}
