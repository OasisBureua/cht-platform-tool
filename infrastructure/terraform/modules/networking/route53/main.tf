# Manages DNS records for the CHT Platform with manual failover support

locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

# Create subdomain hosted zone for platform
resource "aws_route53_zone" "platform" {
  name = var.subdomain_zone

  tags = {
    Name        = "${local.prefix}-platform-zone"
    Environment = var.environment
    Purpose     = "Platform subdomain delegation"
  }
}

# Apex DNS Record - Single domain testapp.communityhealth.media -> CloudFront
# Endpoints (e.g. /api/*) follow under this domain via CloudFront path-based routing
resource "aws_route53_record" "apex" {
  zone_id = aws_route53_zone.platform.zone_id
  name    = ""
  type    = "A"

  alias {
    name                   = var.primary_cloudfront_dns
    zone_id                = var.primary_cloudfront_zone_id
    evaluate_target_health = false
  }
}

# Health check for primary region
# Uses /health (instant) not /health/ready - Route53 timeout is ~2s, DB/Redis checks can exceed that
resource "aws_route53_health_check" "primary" {
  fqdn              = var.primary_alb_dns
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name        = "${local.prefix}-primary-health"
    Environment = var.environment
  }
}

# CloudWatch alarm for health check failure
resource "aws_cloudwatch_metric_alarm" "primary_down" {
  alarm_name          = "${local.prefix}-primary-region-down"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  alarm_description   = "Primary region (us-east-1) health check failing - manual failover may be needed"
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.primary.id
  }

  alarm_actions = var.alarm_actions
}