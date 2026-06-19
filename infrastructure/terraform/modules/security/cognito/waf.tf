locals {
  replica_user_pool_arn = var.enable_multi_region_replication ? "arn:aws:cognito-idp:${var.replica_region}:${data.aws_caller_identity.current.account_id}:userpool/${aws_cognito_user_pool.main.id}" : ""
}

module "waf_primary" {
  count  = var.enable_waf ? 1 : 0
  source = "../waf-cognito"

  project               = var.project
  environment           = var.environment
  enable_managed_rules  = var.waf_enable_managed_rules
  enable_rate_limit     = var.waf_enable_rate_limit
  rate_limit_count      = var.waf_rate_limit_count
  allowed_countries     = var.waf_allowed_countries
}

resource "aws_wafv2_web_acl_association" "primary" {
  count = var.enable_waf ? 1 : 0

  resource_arn = aws_cognito_user_pool.main.arn
  web_acl_arn  = module.waf_primary[0].web_acl_arn
}

module "waf_replica" {
  count  = var.enable_waf && var.enable_multi_region_replication ? 1 : 0
  source = "../waf-cognito"

  providers = {
    aws = aws.replica
  }

  project               = var.project
  environment           = var.environment
  enable_managed_rules  = var.waf_enable_managed_rules
  enable_rate_limit     = var.waf_enable_rate_limit
  rate_limit_count      = var.waf_rate_limit_count
  allowed_countries     = var.waf_allowed_countries
}

# Replica association is created after MRR setup script creates the secondary pool.
resource "aws_wafv2_web_acl_association" "replica" {
  count = var.enable_waf && var.enable_multi_region_replication && var.associate_waf_with_replica ? 1 : 0

  provider = aws.replica

  resource_arn = local.replica_user_pool_arn
  web_acl_arn  = module.waf_replica[0].web_acl_arn
}
