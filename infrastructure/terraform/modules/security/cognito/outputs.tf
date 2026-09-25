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

# --- Hub → platform (inbound to Nest) ---

output "m2m_hub_client_id" {
  description = "cht-hub-m2m-{env} client ID (Hub → platform export/cache.clear)"
  value       = aws_cognito_user_pool_client.hub_m2m.id
}

output "m2m_export_client_id" {
  description = "Alias of m2m_hub_client_id (compat with COGNITO_M2M_EXPORT_CLIENT_ID)"
  value       = aws_cognito_user_pool_client.hub_m2m.id
}

output "m2m_export_scope" {
  description = "platform/export.read"
  value       = local.m2m_export_scope
}

output "m2m_cache_clear_scope" {
  description = "platform/cache.clear"
  value       = local.m2m_cache_clear_scope
}

output "m2m_hub_scopes" {
  description = "Space-delimited scopes on Hub's outbound client"
  value       = local.m2m_hub_client_scopes
}

output "m2m_export_token_url" {
  description = "Cognito OAuth2 token endpoint"
  value       = "${local.hosted_ui_base_url}/oauth2/token"
}

output "m2m_hub_secret_arn" {
  description = "SM ARN cht-{env}-cognito-m2m-hub"
  value       = aws_secretsmanager_secret.m2m_hub.arn
}

output "m2m_hub_secret_name" {
  description = "SM name cht-{env}-cognito-m2m-hub"
  value       = aws_secretsmanager_secret.m2m_hub.name
}

output "m2m_export_secret_arn" {
  description = "Alias of m2m_hub_secret_arn"
  value       = aws_secretsmanager_secret.m2m_hub.arn
}

output "m2m_export_secret_name" {
  description = "Alias of m2m_hub_secret_name"
  value       = aws_secretsmanager_secret.m2m_hub.name
}

# --- Platform → Hub (outbound from Nest) ---

output "m2m_platform_client_id" {
  description = "cht-platform-m2m-{env} client ID (null if enable_platform_outbound_m2m=false)"
  value       = var.enable_platform_outbound_m2m ? aws_cognito_user_pool_client.platform_m2m[0].id : null
}

output "m2m_platform_secret_arn" {
  description = "SM ARN cht-{env}-cognito-m2m-platform"
  value       = var.enable_platform_outbound_m2m ? aws_secretsmanager_secret.m2m_platform[0].arn : null
}

output "m2m_platform_secret_name" {
  description = "SM name cht-{env}-cognito-m2m-platform"
  value       = var.enable_platform_outbound_m2m ? aws_secretsmanager_secret.m2m_platform[0].name : null
}

output "m2m_platform_hub_scopes" {
  description = "hub/… scopes on platform outbound client"
  value       = var.enable_platform_outbound_m2m ? join(" ", var.platform_outbound_hub_scopes) : null
}

output "hosted_ui_base_url" {
  description = "Cognito Hosted UI base URL (used for Google OAuth redirect)"
  value       = local.hosted_ui_base_url
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

output "sms_mfa_enabled" {
  description = "Whether the Cognito→SNS SMS IAM role is provisioned"
  value       = var.enable_sms_mfa
}

output "sms_sns_caller_arn" {
  description = "IAM role ARN Cognito assumes to send SMS (null when SMS MFA infra is off)"
  value       = var.enable_sms_mfa ? aws_iam_role.cognito_sms[0].arn : null
}

output "sms_external_id" {
  description = "sts:ExternalId Cognito must present when assuming the SMS role"
  value       = var.enable_sms_mfa ? local.sms_external_id : null
}
