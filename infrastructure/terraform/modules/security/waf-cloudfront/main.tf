# WAF Web ACL for CloudFront
# Must be created in us-east-1 (CloudFront requirement)
locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

resource "aws_wafv2_web_acl" "cloudfront" {
  name        = "${local.prefix}-cloudfront-waf"
  description = "WAF for CloudFront - ${local.prefix}"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Rate-based rule - limit requests per IP
  dynamic "rule" {
    for_each = var.enable_rate_limit ? [1] : []
    content {
      name     = "${local.prefix}-rate-limit"
      priority = 1

      action {
        block {}
      }

      statement {
        rate_based_statement {
          limit              = var.rate_limit_count
          aggregate_key_type = "IP"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${local.prefix}-rate-limit"
        sampled_requests_enabled   = true
      }
    }
  }

  # AWS Managed Rules - Common Rule Set (SQLi, XSS, etc.)
  dynamic "rule" {
    for_each = var.enable_managed_rules ? [1] : []
    content {
      name     = "${local.prefix}-aws-common-rules"
      priority = 2

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          vendor_name = "AWS"
          name        = "AWSManagedRulesCommonRuleSet"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${local.prefix}-aws-common-rules"
        sampled_requests_enabled   = true
      }
    }
  }

  # AWS Managed Rules - Known Bad Inputs
  dynamic "rule" {
    for_each = var.enable_managed_rules ? [1] : []
    content {
      name     = "${local.prefix}-known-bad-inputs"
      priority = 3

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          vendor_name = "AWS"
          name        = "AWSManagedRulesKnownBadInputsRuleSet"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${local.prefix}-known-bad-inputs"
        sampled_requests_enabled   = true
      }
    }
  }

  # Geo restriction - allow only specified countries (optional)
  dynamic "rule" {
    for_each = length(var.allowed_countries) > 0 ? [1] : []
    content {
      name     = "${local.prefix}-geo-restrict"
      priority = 0 # Highest priority - check first

      action {
        block {}
      }

      statement {
        not_statement {
          statement {
            geo_match_statement {
              country_codes = var.allowed_countries
            }
          }
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${local.prefix}-geo-block"
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.prefix}-cloudfront-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name        = "${local.prefix}-cloudfront-waf"
    Environment = var.environment
  }
}
