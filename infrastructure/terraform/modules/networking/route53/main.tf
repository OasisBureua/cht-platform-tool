# Manages DNS records for the CHT Platform with manual failover support

# Create subdomain hosted zone for platform
resource "aws_route53_zone" "platform" {
  name = var.subdomain_zone

  tags = {
    Name        = "${var.project}-${var.environment}-platform-zone"
    Environment = var.environment
    Purpose     = "Platform subdomain delegation"
  }
}

# API DNS Record - Points to primary ALB by default
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.platform.zone_id
  name    = "api"
  type    = "A"

  alias {
    name                   = var.primary_alb_dns
    zone_id                = var.primary_alb_zone_id
    evaluate_target_health = true
  }
}

# App DNS Record - Points to primary CloudFront by default
resource "aws_route53_record" "app" {
  zone_id = aws_route53_zone.platform.zone_id
  name    = "app"
  type    = "A"

  alias {
    name                   = var.primary_cloudfront_dns
    zone_id                = var.primary_cloudfront_zone_id
    evaluate_target_health = false
  }
}

# Health check for primary region
resource "aws_route53_health_check" "primary" {
  fqdn              = var.primary_alb_dns
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health/ready"
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name        = "${var.project}-${var.environment}-primary-health"
    Environment = var.environment
  }
}

# CloudWatch alarm for health check failure
resource "aws_cloudwatch_metric_alarm" "primary_down" {
  alarm_name          = "${var.project}-${var.environment}-primary-region-down"
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